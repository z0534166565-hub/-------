package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

type Privilege string

type Privileges map[Privilege]bool

var privilegesUsers sync.Map

var adminUsers []string = strings.Split(
	os.Getenv("ADMIN_USERS"),
	",",
)

const (
	Admin     Privilege = "admin"
	Moderator Privilege = "moderator"
	Writer    Privilege = "writer"
)

func initializePrivilegeUsers() {
	ctx, cancel := context.WithTimeout(
		context.Background(),
		5*time.Second,
	)
	defer cancel()

	privilegesUsers.Clear()

	users, err := dbGetUsersList(ctx)

	if err != nil && err != redis.Nil {
		panic(
			"Failed to get users list from database: " +
				err.Error(),
		)
	}

	existsEmails := make(map[string]bool)

	for _, user := range users {
		if user.Email != "" {
			existsEmails[strings.ToLower(user.Email)] = true
		}
	}

	/*
		משתמשים שמוגדרים ב-ADMIN_USERS מקבלים
		הרשאות מנהל ראשי אוטומטית.
	*/
	for _, admin := range adminUsers {
		admin = strings.TrimSpace(admin)

		if admin == "" {
			continue
		}

		adminLower := strings.ToLower(admin)

		if !existsEmails[adminLower] {
			users = append(users, User{
				Username: "",
				Email:    admin,
				Privileges: Privileges{
					Admin:     true,
					Moderator: true,
					Writer:    true,
				},
			})

			existsEmails[adminLower] = true
		}
	}

	for _, user := range users {
		if user.Email != "" {
			privilegesUsers.Store(
				user.Email,
				user,
			)
		}
	}

	if err := dbSetUsersList(ctx, users); err != nil {
		panic(
			"Failed to set users list in database: " +
				err.Error(),
		)
	}
}

func (p Privileges) MarshalBinary() ([]byte, error) {
	return json.Marshal(p)
}

func (p *Privileges) UnmarshalBinary(data []byte) error {
	return json.Unmarshal(data, p)
}

/*
===========================================================
משתמשים מורשים
===========================================================
*/

func getPrivilegeUsersList(
	w http.ResponseWriter,
	r *http.Request,
) {
	ctx, cancel := context.WithTimeout(
		context.Background(),
		5*time.Second,
	)
	defer cancel()

	users, err := dbGetUsersList(ctx)

	if err != nil {
		http.Error(
			w,
			"Failed to get users list",
			http.StatusInternalServerError,
		)
		return
	}

	w.Header().Set(
		"Content-Type",
		"application/json",
	)

	json.NewEncoder(w).Encode(users)
}

func setPrivilegeUsers(
	w http.ResponseWriter,
	r *http.Request,
) {
	ctx, cancel := context.WithTimeout(
		context.Background(),
		5*time.Second,
	)
	defer cancel()

	defer r.Body.Close()

	var req struct {
		List []User `json:"list"`
	}

	if err := json.NewDecoder(
		r.Body,
	).Decode(&req); err != nil {
		http.Error(
			w,
			"Invalid request body",
			http.StatusBadRequest,
		)
		return
	}

	log.Println(
		"Setting privileges for users:",
		req.List,
	)

	if err := dbSetUsersList(
		ctx,
		req.List,
	); err != nil {
		http.Error(
			w,
			"Failed to set users list",
			http.StatusInternalServerError,
		)
		return
	}

	initializePrivilegeUsers()

	response := Response{
		Success: true,
	}

	w.Header().Set(
		"Content-Type",
		"application/json",
	)

	json.NewEncoder(w).Encode(response)
}

/*
===========================================================
PENDING USERS
===========================================================
*/

/*
	GET /api/admin/pending-users

	מחזיר למנהל את כל המשתמשים שממתינים לאישור.
*/
func getPendingUsers(
	w http.ResponseWriter,
	r *http.Request,
) {
	ctx, cancel := context.WithTimeout(
		context.Background(),
		5*time.Second,
	)
	defer cancel()

	users, err := dbGetPendingUsersList(ctx)

	if err != nil {
		http.Error(
			w,
			"Failed to get pending users",
			http.StatusInternalServerError,
		)
		return
	}

	w.Header().Set(
		"Content-Type",
		"application/json",
	)

	json.NewEncoder(w).Encode(users)
}

/*
	POST /api/admin/pending-users/approve

	מאשר משתמש שממתין.
*/
func approvePendingUser(
	w http.ResponseWriter,
	r *http.Request,
) {
	ctx, cancel := context.WithTimeout(
		context.Background(),
		5*time.Second,
	)
	defer cancel()

	defer r.Body.Close()

	var req struct {
		Email string `json:"email"`
	}

	if err := json.NewDecoder(
		r.Body,
	).Decode(&req); err != nil {
		http.Error(
			w,
			"Invalid request body",
			http.StatusBadRequest,
		)
		return
	}

	req.Email = strings.TrimSpace(req.Email)

	if req.Email == "" {
		http.Error(
			w,
			"Email is required",
			http.StatusBadRequest,
		)
		return
	}

	/*
		מוצאים את המשתמש ברשימת הממתינים.
	*/
	pendingUser, err := dbGetPendingUser(
		ctx,
		req.Email,
	)

	if err != nil {
		if err == redis.Nil {
			http.Error(
				w,
				"Pending user not found",
				http.StatusNotFound,
			)
			return
		}

		http.Error(
			w,
			"Failed to get pending user",
			http.StatusInternalServerError,
		)
		return
	}

	/*
		בודקים האם המשתמש כבר מאושר.
	*/
	users, err := dbGetUsersList(ctx)

	if err != nil {
		http.Error(
			w,
			"Failed to get users list",
			http.StatusInternalServerError,
		)
		return
	}

	for _, user := range users {
		if strings.EqualFold(
			user.Email,
			pendingUser.Email,
		) {
			/*
				כבר מאושר — רק נסיר אותו
				מרשימת הממתינים.
			*/
			if err := dbRemovePendingUser(
				ctx,
				pendingUser.Email,
			); err != nil {
				http.Error(
					w,
					"Failed to remove pending user",
					http.StatusInternalServerError,
				)
				return
			}

			response := Response{
				Success: true,
				Status:  "already-approved",
			}

			w.Header().Set(
				"Content-Type",
				"application/json",
			)

			json.NewEncoder(w).Encode(response)
			return
		}
	}

	/*
		יוצרים משתמש מאושר.

		ברירת המחדל:
		ללא Admin / Moderator / Writer.
	*/
	newUser := User{
		ID:         pendingUser.ID,
		Username:   pendingUser.Username,
		Email:      pendingUser.Email,
		PublicName: pendingUser.PublicName,
		Privileges: Privileges{
			Admin:     false,
			Moderator: false,
			Writer:    false,
		},
	}

	users = append(users, newUser)

	if err := dbSetUsersList(
		ctx,
		users,
	); err != nil {
		http.Error(
			w,
			"Failed to approve user",
			http.StatusInternalServerError,
		)
		return
	}

	/*
		מעדכנים את הזיכרון של השרת.
	*/
	privilegesUsers.Store(
		newUser.Email,
		newUser,
	)

	/*
		מסירים את המשתמש מרשימת הממתינים.
	*/
	if err := dbRemovePendingUser(
		ctx,
		pendingUser.Email,
	); err != nil {
		http.Error(
			w,
			"User approved but failed to remove pending request",
			http.StatusInternalServerError,
		)
		return
	}

	response := Response{
		Success: true,
		Status:  "approved",
	}

	w.Header().Set(
		"Content-Type",
		"application/json",
	)

	json.NewEncoder(w).Encode(response)
}

/*
	POST /api/admin/pending-users/reject

	דוחה ומסיר משתמש מרשימת הממתינים.
*/
func rejectPendingUser(
	w http.ResponseWriter,
	r *http.Request,
) {
	ctx, cancel := context.WithTimeout(
		context.Background(),
		5*time.Second,
	)
	defer cancel()

	defer r.Body.Close()

	var req struct {
		Email string `json:"email"`
	}

	if err := json.NewDecoder(
		r.Body,
	).Decode(&req); err != nil {
		http.Error(
			w,
			"Invalid request body",
			http.StatusBadRequest,
		)
		return
	}

	req.Email = strings.TrimSpace(req.Email)

	if req.Email == "" {
		http.Error(
			w,
			"Email is required",
			http.StatusBadRequest,
		)
		return
	}

	/*
		מוודאים שהבקשה קיימת.
	*/
	_, err := dbGetPendingUser(
		ctx,
		req.Email,
	)

	if err != nil {
		if err == redis.Nil {
			http.Error(
				w,
				"Pending user not found",
				http.StatusNotFound,
			)
			return
		}

		http.Error(
			w,
			"Failed to get pending user",
			http.StatusInternalServerError,
		)
		return
	}

	/*
		מסירים את הבקשה.
	*/
	if err := dbRemovePendingUser(
		ctx,
		req.Email,
	); err != nil {
		http.Error(
			w,
			"Failed to reject pending user",
			http.StatusInternalServerError,
		)
		return
	}

	response := Response{
		Success: true,
		Status:  "rejected",
	}

	w.Header().Set(
		"Content-Type",
		"application/json",
	)

	json.NewEncoder(w).Encode(response)
}
