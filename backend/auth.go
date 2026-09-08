package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/boj/redistore"
	"github.com/icza/dyno"
	"github.com/redis/go-redis/v9"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/idtoken"
)

var secretKey string = os.Getenv("SECRET_KEY")
var store = &redistore.RediStore{}
var cookieName = "channel_session"

var (
	googleOAuthScopes       = "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile"
	googleOAuthUrl          = google.Endpoint.AuthURL
	googleOAuthClientId     = os.Getenv("GOOGLE_CLIENT_ID")
	googleOAuthClientSecret = os.Getenv("GOOGLE_CLIENT_SECRET")
)

type Auth struct {
	Code string `json:"code"`
}

type GoogleAuthValues struct {
	GoogleOauthUrl   string `json:"googleOauthUrl"`
	GoogleOauthScope string `json:"googleOauthScope"`
	GoogleClientId   string `json:"googleClientId"`
}

type Session struct {
	ID         string     `json:"id"`
	Username   string     `json:"username"`
	Email      string     `json:"email"`
	PublicName string     `json:"publicName"`
	Picture    string     `json:"picture,omitempty"`
	Privileges Privileges `json:"privileges,omitempty"`
	Approved   bool       `json:"approved"`
}

type Response struct {
	Success bool `json:"success"`
}

func isAdminEmail(email string) bool {
	admins := strings.Split(os.Getenv("ADMIN_USERS"), ",")

	for _, admin := range admins {
		if strings.EqualFold(
			strings.TrimSpace(admin),
			strings.TrimSpace(email),
		) {
			return true
		}
	}

	return false
}

func getGoogleAuthValues(w http.ResponseWriter, r *http.Request) {
	authValues := GoogleAuthValues{
		GoogleOauthUrl:   googleOAuthUrl,
		GoogleOauthScope: googleOAuthScopes,
		GoogleClientId:   googleOAuthClientId,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(authValues)
}

func login(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	defer r.Body.Close()

	var auth Auth

	if err := json.NewDecoder(r.Body).Decode(&auth); err != nil {
		go saveLoginFailedLog("Decode", err)
		http.Error(w, "error", http.StatusBadRequest)
		return
	}

	if auth.Code == "" {
		go saveLoginFailedLog(
			"Decode",
			errors.New("invalid credentials"),
		)
		http.Error(
			w,
			"Invalid credentials",
			http.StatusUnauthorized,
		)
		return
	}

	origin := r.Header.Get("Origin")

	googleOAuthConfig := &oauth2.Config{
		ClientID:     googleOAuthClientId,
		ClientSecret: googleOAuthClientSecret,
		RedirectURL:  origin + "/login",
		Endpoint:     google.Endpoint,
	}

	token, err := googleOAuthConfig.Exchange(ctx, auth.Code)
	if err != nil {
		go saveLoginFailedLog("Exchange", err)
		http.Error(
			w,
			"error",
			http.StatusInternalServerError,
		)
		return
	}

	if !token.Valid() {
		go saveLoginFailedLog("Invalid token", nil)
		http.Error(
			w,
			"Invalid token",
			http.StatusUnauthorized,
		)
		return
	}

	tokenStr, _ := dyno.GetString(
		token.Extra("id_token"),
	)

	tokenValidator, err := idtoken.NewValidator(ctx)
	if err != nil {
		http.Error(
			w,
			"Invalid token",
			http.StatusUnauthorized,
		)
		return
	}

	payload, err := tokenValidator.Validate(
		ctx,
		tokenStr,
		googleOAuthClientId,
	)

	if err != nil {
		http.Error(
			w,
			"Invalid token",
			http.StatusUnauthorized,
		)
		return
	}

	email, _ := dyno.GetString(
		payload.Claims["email"],
	)

	go registeringEmail(email)

	u, err := getUser(ctx, payload.Claims)
	if err != nil {
		go saveLoginFailedLog("getUser", err)
		http.Error(
			w,
			"error",
			http.StatusInternalServerError,
		)
		return
	}

	picture, _ := dyno.GetString(
		payload.Claims["picture"],
	)

	userSession := Session{
		ID:         u.ID,
		Username:   u.Username,
		PublicName: u.PublicName,
		Picture:    picture,
		Privileges: u.Privileges,
		Email:      u.Email,
		Approved:   u.Approved,
	}

	session, _ := store.Get(r, cookieName)

	session.Values["user"] = userSession
	session.Options.MaxAge = 60 * 60 * 24 * 30

	if err := session.Save(r, w); err != nil {
		go saveLoginFailedLog(
			"sessionSave",
			err,
		)

		http.Error(
			w,
			"error",
			http.StatusInternalServerError,
		)
		return
	}

	w.Header().Set(
		"Content-Type",
		"application/json",
	)

	response := Response{
		Success: true,
	}

	json.NewEncoder(w).Encode(response)
}

func logout(w http.ResponseWriter, r *http.Request) {
	session, _ := store.Get(r, cookieName)

	session.Values["user"] = nil
	session.Options.MaxAge = -1

	err := session.Save(r, w)

	if err != nil {
		http.Error(
			w,
			"error",
			http.StatusInternalServerError,
		)
		return
	}

	w.Header().Set(
		"Content-Type",
		"application/json",
	)

	response := Response{
		Success: true,
	}

	json.NewEncoder(w).Encode(response)
}

func checkLogin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

		session, _ := store.Get(r, cookieName)

		_, ok := session.Values["user"].(Session)

		if !ok {
			http.Error(
				w,
				"User not authenticated",
				http.StatusUnauthorized,
			)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func checkApproved(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

		session, _ := store.Get(r, cookieName)

		user, ok := session.Values["user"].(Session)

		if !ok {
			http.Error(
				w,
				"User not authenticated",
				http.StatusUnauthorized,
			)
			return
		}

		if !user.Approved && !user.Privileges[Admin] {
			http.Error(
				w,
				"User awaiting approval",
				http.StatusForbidden,
			)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func checkPrivilege(
	r *http.Request,
	privilege Privilege,
) bool {

	session, _ := store.Get(r, cookieName)

	s, ok := session.Values["user"].(Session)

	if !ok {
		return false
	}

	return s.Privileges[privilege]
}

func getUserInfo(
	w http.ResponseWriter,
	r *http.Request,
) {
	session, _ := store.Get(r, cookieName)

	userInfo, ok :=
		session.Values["user"].(Session)

	if !ok {
		http.Error(
			w,
			"User not found",
			http.StatusNotFound,
		)
		return
	}

	w.Header().Set(
		"Content-Type",
		"application/json",
	)

	json.NewEncoder(w).Encode(userInfo)
}

func getUser(
	ctx context.Context,
	claims map[string]any,
) (*User, error) {

	var user User

	email, _ := dyno.GetString(
		claims["email"],
	)

	if email == "" {
		return nil, errors.New(
			"email not found in claims",
		)
	}

	name, _ := dyno.GetString(
		claims["name"],
	)

	if name == "" {
		name = email
	}

	id, _ := dyno.GetString(
		claims["sub"],
	)

	if v, ok := privilegesUsers.Load(email); ok {

		user = v.(User)

		if user.ID != id && id != "" {
			user.ID = id
		}

		if user.Username == "" {
			user.Username = name
		}

		if user.Email == "" {
			user.Email = email
		}

		if user.PublicName == "" {
			user.PublicName = name
		}

	} else {

		user = User{
			ID:         id,
			Username:   name,
			Email:      email,
			PublicName: name,
			Approved:   false,
			Privileges: Privileges{},
		}
	}

	if isAdminEmail(email) {

		user.Approved = true

		if user.Privileges == nil {
			user.Privileges = Privileges{}
		}

		user.Privileges[Admin] = true
		user.Privileges[Moderator] = true
		user.Privileges[Writer] = true
	}

	privilegesUsers.Store(email, user)

	users, err := dbGetUsersList(ctx)

	if err != nil && err != redis.Nil {
		return nil, err
	}

	found := false

	for i, u := range users {

		if strings.EqualFold(
			strings.TrimSpace(u.Email),
			strings.TrimSpace(email),
		) {
			users[i] = user
			found = true
			break
		}
	}

	if !found {
		users = append(users, user)
	}

	if err := dbSetUsersList(
		ctx,
		users,
	); err != nil {
		return nil, err
	}

	return &user, nil
}