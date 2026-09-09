```go
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

			origin :=
				r.Header.Get("Origin")

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

			next.ServeHTTP(
				w,
				r,
			)
		},
	)
}

/*
	הגדרות Cookie עבור חיבור
	GitHub Pages -> Render.
*/
func configureSessionCookie(
	session *sessions.Session,
) {

	session.Options.HttpOnly = true

	session.Options.Secure = true

	session.Options.SameSite =
		http.SameSiteNoneMode

	session.Options.Path = "/"
}

/*
	כתובת ה-Redirect הקבועה
	של Google OAuth.
*/
func googleRedirectURL() string {
	return frontendLoginURL
}

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
			errors.New(
				"invalid credentials",
			),
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

			ClientID:
				googleOAuthClientId,

			ClientSecret:
				googleOAuthClientSecret,

			RedirectURL:
				googleRedirectURL(),

			Endpoint:
				google.Endpoint,
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
		strings.TrimSpace(
			strings.ToLower(email),
		)

	if name == "" {
		name = email
	}

	go registeringEmail(email)

	/*
		בדיקה האם המשתמש מאושר.
	*/
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

		response :=
			Response{
				Success: false,
				Status:  "pending",
			}

		json.NewEncoder(w).Encode(
			response,
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

	userSession :=
		Session{
			ID:         u.ID,
			Username:   u.Username,
			PublicName: u.PublicName,
			Picture:    picture,
			Privileges: u.Privileges,
			Email:      u.Email,
		}

	session, err :=
		store.Get(
			r,
			cookieName,
		)

	if err != nil {

		go saveLoginFailedLog(
			"sessionGet",
			err,
		)

		http.Error(
			w,
			"error",
			http.StatusInternalServerError,
		)

		return
	}

	configureSessionCookie(
		session,
	)

	session.Values["user"] =
		userSession

	session.Options.MaxAge =
		60 * 60 * 24 * 30

	if err :=
		session.Save(
			r,
			w,
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

	response :=
		Response{
			Success: true,
			Status:  "approved",
		}

	json.NewEncoder(w).Encode(
		response,
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

	configureSessionCookie(
		session,
	)

	session.Values["user"] = nil

	session.Options.MaxAge = -1

	if err :=
		session.Save(
			r,
			w,
		); err != nil {

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

	response :=
		Response{
			Success: true,
		}

	json.NewEncoder(w).Encode(
		response,
	)
}

func checkLogin(
	next http.Handler,
) http.Handler {

	return http.HandlerFunc(
		func(
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

		return nil,
			errors.New(
				"email not found in claims",
			)
	}

	email =
		strings.ToLower(
			strings.TrimSpace(
				email,
			),
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

			return nil,
				errors.New(
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

	return nil,
		errors.New(
			"user is not approved",
		)
}
