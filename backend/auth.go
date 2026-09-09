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
	"github.com/gorilla/sessions"
	"github.com/icza/dyno"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/idtoken"
)

var secretKey string = os.Getenv("SECRET_KEY")

var store = &redistore.RediStore{}

var cookieName = "channel_session"

const frontendOrigin =
	"https://z0534166565-hub.github.io"

const frontendLoginURL =
	"https://z0534166565-hub.github.io/Updates-from-the-House-of-Elders/login"

var (
	googleOAuthScopes =
		"https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile"

	googleOAuthUrl =
		google.Endpoint.AuthURL

	googleOAuthClientId =
		os.Getenv("GOOGLE_CLIENT_ID")

	googleOAuthClientSecret =
		os.Getenv("GOOGLE_CLIENT_SECRET")
)

type Auth struct {
	Code string `json:"code"`
}

type PasswordLoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
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
}

type Response struct {
	Success bool   `json:"success"`
	Status  string `json:"status,omitempty"`
}

/*
	CORS
*/
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {

			origin := r.Header.Get("Origin")

			if origin == frontendOrigin {

				w.Header().Set(
					"Access-Control-Allow-Origin",
					frontendOrigin,
				)

				w.Header().Set(
					"Access-Control-Allow-Credentials",
					"true",
				)

				w.Header().Set(
					"Access-Control-Allow-Headers",
					"Content-Type, Authorization, X-Requested-With",
				)

				w.Header().Set(
					"Access-Control-Allow-Methods",
					"GET, POST, PUT, PATCH, DELETE, OPTIONS",
				)

				w.Header().Set(
					"Vary",
					"Origin",
				)
			}

			if r.Method == http.MethodOptions {

				if origin == frontendOrigin {

					w.WriteHeader(
						http.StatusNoContent,
					)

					return
				}

				http.Error(
					w,
					"CORS origin not allowed",
					http.StatusForbidden,
				)

				return
			}

			next.ServeHTTP(w, r)
		},
	)
}

/*
	הגדרות Cookie
*/
func configureSessionCookie(session *sessions.Session) {

	session.Options.HttpOnly = true
	session.Options.Secure = true
	session.Options.SameSite = http.SameSiteNoneMode
	session.Options.Path = "/"
}

/*
	Google Redirect
*/
func googleRedirectURL() string {
	return frontendLoginURL
}

/*
	Redis key עבור סיסמה.
	הסיסמה עצמה לעולם לא נשמרת.
*/
func passwordRedisKey(email string) string {

	email =
		strings.ToLower(
			strings.TrimSpace(email),
		)

	return "user:password:" + email
}

/*
	שמירת hash של סיסמה.
*/
func savePasswordHash(
	ctx context.Context,
	email string,
	password string,
) error {

	if len(password) < 6 {
		return errors.New(
			"password must contain at least 6 characters",
		)
	}

	if len([]byte(password)) > 72 {
		return errors.New(
			"password is too long",
		)
	}

	hash, err :=
		bcrypt.GenerateFromPassword(
			[]byte(password),
			bcrypt.DefaultCost,
		)

	if err != nil {
		return err
	}

	return rdb.Set(
		ctx,
		passwordRedisKey(email),
		string(hash),
		0,
	).Err()
}

/*
	קבלת hash של סיסמה.
*/
func getPasswordHash(
	ctx context.Context,
	email string,
) (string, error) {

	hash, err :=
		rdb.Get(
			ctx,
			passwordRedisKey(email),
		).Result()

	if err != nil {
		return "", err
	}

	return hash, nil
}

/*
	יצירת Session לאחר אימות.
*/
func createUserSession(
	w http.ResponseWriter,
	r *http.Request,
	user User,
	picture string,
) error {

	session, err :=
		store.Get(
			r,
			cookieName,
		)

	if err != nil {
		return err
	}

	configureSessionCookie(session)

	userSession := Session{
		ID:         user.ID,
		Username:   user.Username,
		PublicName: user.PublicName,
		Picture:    picture,
		Privileges: user.Privileges,
		Email:      user.Email,
	}

	session.Values["user"] =
		userSession

	session.Options.MaxAge =
		60 * 60 * 24 * 30

	return session.Save(
		r,
		w,
	)
}

/*
	Google Auth Values
*/
func getGoogleAuthValues(
	w http.ResponseWriter,
	r *http.Request,
) {

	authValues :=
		GoogleAuthValues{
			GoogleOauthUrl:   googleOAuthUrl,
			GoogleOauthScope: googleOAuthScopes,
			GoogleClientId:   googleOAuthClientId,
		}

	w.Header().Set(
		"Content-Type",
		"application/json",
	)

	json.NewEncoder(w).Encode(
		authValues,
	)
}

/*
	Google Login
*/
func login(
	w http.ResponseWriter,
	r *http.Request,
) {

	ctx, cancel :=
		context.WithTimeout(
			r.Context(),
			5*time.Second,
		)

	defer cancel()
	defer r.Body.Close()

	var auth Auth

	if err :=
		json.NewDecoder(
			r.Body,
		).Decode(&auth); err != nil {

		go saveLoginFailedLog(
			"Decode",
			err,
		)

		http.Error(
			w,
			"error",
			http.StatusBadRequest,
		)

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

	googleOAuthConfig :=
		&oauth2.Config{
			ClientID:     googleOAuthClientId,
			ClientSecret: googleOAuthClientSecret,
			RedirectURL:  googleRedirectURL(),
			Endpoint:     google.Endpoint,
		}

	token, err :=
		googleOAuthConfig.Exchange(
			ctx,
			auth.Code,
		)

	if err != nil {

		go saveLoginFailedLog(
			"Exchange",
			err,
		)

		http.Error(
			w,
			"error",
			http.StatusInternalServerError,
		)

		return
	}

	if !token.Valid() {

		go saveLoginFailedLog(
			"Invalid token",
			nil,
		)

		http.Error(
			w,
			"Invalid token",
			http.StatusUnauthorized,
		)

		return
	}

	tokenStr, _ :=
		dyno.GetString(
			token.Extra("id_token"),
		)

	tokenValidator, err :=
		idtoken.NewValidator(ctx)

	if err != nil {

		go saveLoginFailedLog(
			"TokenValidator",
			err,
		)

		http.Error(
			w,
			"Invalid token",
			http.StatusUnauthorized,
		)

		return
	}

	payload, err :=
		tokenValidator.Validate(
			ctx,
			tokenStr,
			googleOAuthClientId,
		)

	if err != nil {

		go saveLoginFailedLog(
			"ValidateToken",
			err,
		)

		http.Error(
			w,
			"Invalid token",
			http.StatusUnauthorized,
		)

		return
	}

	email, _ :=
		dyno.GetString(
			payload.Claims["email"],
		)

	name, _ :=
		dyno.GetString(
			payload.Claims["name"],
		)

	id, _ :=
		dyno.GetString(
			payload.Claims["sub"],
		)

	picture, _ :=
		dyno.GetString(
			payload.Claims["picture"],
		)

	if email == "" {

		http.Error(
			w,
			"Email not found",
			http.StatusUnauthorized,
		)

		return
	}

	email =
		strings.ToLower(
			strings.TrimSpace(email),
		)

	if name == "" {
		name = email
	}

	go registeringEmail(email)

	if _, approved :=
		privilegesUsers.Load(email); !approved {

		pendingUser :=
			PendingUser{
				ID:         id,
				Username:   name,
				Email:      email,
				PublicName: name,
				Picture:    picture,
				CreatedAt:  time.Now(),
			}

		if err :=
			dbAddPendingUser(
				ctx,
				pendingUser,
			); err != nil {

			go saveLoginFailedLog(
				"addPendingUser",
				err,
			)

			http.Error(
				w,
				"Failed to save pending user",
				http.StatusInternalServerError,
			)

			return
		}

		w.Header().Set(
			"Content-Type",
			"application/json",
		)

		w.WriteHeader(
			http.StatusForbidden,
		)

		json.NewEncoder(w).Encode(
			Response{
				Success: false,
				Status:  "pending",
			},
		)

		return
	}

	u, err :=
		getUser(
			ctx,
			payload.Claims,
		)

	if err != nil {

		go saveLoginFailedLog(
			"getUser",
			err,
		)

		http.Error(
			w,
			"User is not approved",
			http.StatusForbidden,
		)

		return
	}

	if err :=
		dbRemovePendingUser(
			ctx,
			email,
		); err != nil {

		go saveLoginFailedLog(
			"removePendingUser",
			err,
		)
	}

	if err :=
		createUserSession(
			w,
			r,
			*u,
			picture,
		); err != nil {

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

	json.NewEncoder(w).Encode(
		Response{
			Success: true,
			Status:  "approved",
		},
	)
}

/*
	Email + Password Login
*/
func passwordLogin(
	w http.ResponseWriter,
	r *http.Request,
) {

	ctx, cancel :=
		context.WithTimeout(
			r.Context(),
			5*time.Second,
		)

	defer cancel()
	defer r.Body.Close()

	var request PasswordLoginRequest

	if err :=
		json.NewDecoder(
			r.Body,
		).Decode(&request); err != nil {

		http.Error(
			w,
			"Invalid request",
			http.StatusBadRequest,
		)

		return
	}

	email :=
		strings.ToLower(
			strings.TrimSpace(
				request.Email,
			),
		)

	password :=
		request.Password

	if email == "" ||
		password == "" {

		http.Error(
			w,
			"Email and password are required",
			http.StatusBadRequest,
		)

		return
	}

	if len([]byte(password)) > 72 {

		http.Error(
			w,
			"Invalid email or password",
			http.StatusUnauthorized,
		)

		return
	}

	/*
		בודקים האם המשתמש מאושר.
	*/
	userValue, approved :=
		privilegesUsers.Load(email)

	if !approved {

		/*
			המשתמש עדיין לא מאושר.
		ניצור עבורו בקשת אישור ונשמור את
		הסיסמה כ-hash בלבד.
		*/

		if err :=
			savePasswordHash(
				ctx,
				email,
				password,
			); err != nil {

			http.Error(
				w,
				"Failed to save password",
				http.StatusInternalServerError,
			)

			return
		}

		pendingUser :=
			PendingUser{
				ID:         "",
				Username:   email,
				Email:      email,
				PublicName: email,
				CreatedAt:  time.Now(),
			}

		if err :=
			dbAddPendingUser(
				ctx,
				pendingUser,
			); err != nil {

			go saveLoginFailedLog(
				"passwordAddPendingUser",
				err,
			)

			http.Error(
				w,
				"Failed to save pending user",
				http.StatusInternalServerError,
			)

			return
		}

		w.Header().Set(
			"Content-Type",
			"application/json",
		)

		w.WriteHeader(
			http.StatusForbidden,
		)

		json.NewEncoder(w).Encode(
			Response{
				Success: false,
				Status:  "pending",
			},
		)

		return
	}

	user, ok :=
		userValue.(User)

	if !ok {

		http.Error(
			w,
			"Invalid user",
			http.StatusInternalServerError,
		)

		return
	}

	passwordHash, err :=
		getPasswordHash(
			ctx,
			email,
		)

	if err == redis.Nil {

		http.Error(
			w,
			"Password login is not configured for this account",
			http.StatusUnauthorized,
		)

		return
	}

	if err != nil {

		go saveLoginFailedLog(
			"getPasswordHash",
			err,
		)

		http.Error(
			w,
			"error",
			http.StatusInternalServerError,
		)

		return
	}

	if err :=
		bcrypt.CompareHashAndPassword(
			[]byte(passwordHash),
			[]byte(password),
		); err != nil {

		http.Error(
			w,
			"Invalid email or password",
			http.StatusUnauthorized,
		)

		return
	}

	if err :=
		createUserSession(
			w,
			r,
			user,
			"",
		); err != nil {

		go saveLoginFailedLog(
			"passwordSessionSave",
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

	json.NewEncoder(w).Encode(
		Response{
			Success: true,
			Status:  "approved",
		},
	)
}

func logout(
	w http.ResponseWriter,
	r *http.Request,
) {

	session, err :=
		store.Get(
			r,
			cookieName,
		)

	if err != nil {

		http.Error(
			w,
			"error",
			http.StatusInternalServerError,
		)

		return
	}

	configureSessionCookie(session)

	session.Values["user"] = nil
	session.Options.MaxAge = -1

	if err :=
		session.Save(r, w); err != nil {

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

	json.NewEncoder(w).Encode(
		Response{
			Success: true,
		},
	)
}

func checkLogin(
	next http.Handler,
) http.Handler {

	return http.HandlerFunc(
		func(w http.ResponseWriter, r *http.Request) {

			session, err :=
				store.Get(
					r,
					cookieName,
				)

			if err != nil {

				http.Error(
					w,
					"User not authenticated",
					http.StatusUnauthorized,
				)

				return
			}

			userValue, ok :=
				session.Values["user"]

			if !ok {

				http.Error(
					w,
					"User not authenticated",
					http.StatusUnauthorized,
				)

				return
			}

			userSession, ok :=
				userValue.(Session)

			if !ok {

				http.Error(
					w,
					"User not authenticated",
					http.StatusUnauthorized,
				)

				return
			}

			email :=
				strings.ToLower(
					strings.TrimSpace(
						userSession.Email,
					),
				)

			approvedUser, approved :=
				privilegesUsers.Load(email)

			if !approved {

				session.Values["user"] = nil
				session.Options.MaxAge = -1

				configureSessionCookie(
					session,
				)

				_ = session.Save(
					r,
					w,
				)

				http.Error(
					w,
					"User is not approved",
					http.StatusForbidden,
				)

				return
			}

			if user, ok :=
				approvedUser.(User); ok {

				userSession.ID =
					user.ID

				userSession.Username =
					user.Username

				userSession.Email =
					user.Email

				userSession.PublicName =
					user.PublicName

				userSession.Privileges =
					user.Privileges

				session.Values["user"] =
					userSession

				configureSessionCookie(
					session,
				)

				_ = session.Save(
					r,
					w,
				)
			}

			next.ServeHTTP(
				w,
				r,
			)
		},
	)
}

func checkPrivilege(
	r *http.Request,
	privilege Privilege,
) bool {

	session, err :=
		store.Get(
			r,
			cookieName,
		)

	if err != nil {
		return false
	}

	s, ok :=
		session.Values["user"].(Session)

	if !ok {
		return false
	}

	email :=
		strings.ToLower(
			strings.TrimSpace(
				s.Email,
			),
		)

	userValue, approved :=
		privilegesUsers.Load(email)

	if !approved {
		return false
	}

	user, ok :=
		userValue.(User)

	if !ok {
		return false
	}

	return user.Privileges[privilege]
}

func getUserInfo(
	w http.ResponseWriter,
	r *http.Request,
) {

	session, err :=
		store.Get(
			r,
			cookieName,
		)

	if err != nil {

		http.Error(
			w,
			"User not found",
			http.StatusUnauthorized,
		)

		return
	}

	userInfo, ok :=
		session.Values["user"].(Session)

	if !ok {

		http.Error(
			w,
			"User not found",
			http.StatusUnauthorized,
		)

		return
	}

	email :=
		strings.ToLower(
			strings.TrimSpace(
				userInfo.Email,
			),
		)

	if _, approved :=
		privilegesUsers.Load(email); !approved {

		session.Values["user"] = nil
		session.Options.MaxAge = -1

		configureSessionCookie(
			session,
		)

		_ = session.Save(
			r,
			w,
		)

		http.Error(
			w,
			"User not approved",
			http.StatusForbidden,
		)

		return
	}

	w.Header().Set(
		"Content-Type",
		"application/json",
	)

	json.NewEncoder(w).Encode(
		userInfo,
	)
}

func getUser(
	ctx context.Context,
	claims map[string]any,
) (*User, error) {

	var user User

	email, _ :=
		dyno.GetString(
			claims["email"],
		)

	if email == "" {
		return nil, errors.New(
			"email not found in claims",
		)
	}

	email =
		strings.ToLower(
			strings.TrimSpace(email),
		)

	name, _ :=
		dyno.GetString(
			claims["name"],
		)

	if name == "" {
		name = email
	}

	id, _ :=
		dyno.GetString(
			claims["sub"],
		)

	if v, ok :=
		privilegesUsers.Load(email); ok {

		user, ok =
			v.(User)

		if !ok {
			return nil, errors.New(
				"invalid approved user",
			)
		}

		if user.ID != id &&
			id != "" {

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

		privilegesUsers.Store(
			email,
			user,
		)

		users, err :=
			dbGetUsersList(ctx)

		if err != nil &&
			err != redis.Nil {

			return nil, err
		}

		for i, u :=
			range users {

			if strings.EqualFold(
				u.Email,
				email,
			) {
				users[i] = user
			}
		}

		if err :=
			dbSetUsersList(
				ctx,
				users,
			); err != nil {

			return nil, err
		}

		return &user, nil
	}

	return nil, errors.New(
		"user is not approved",
	)
}
