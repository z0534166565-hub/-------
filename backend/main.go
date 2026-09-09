package main

import (
	"bytes"
	"encoding/gob"
	"log"
	"net/http"
	_ "net/http/pprof"
	"os"
	"path/filepath"

	"github.com/boj/redistore"
	"github.com/go-chi/chi"
	"github.com/go-chi/chi/middleware"
)

var rootStaticFolder = os.Getenv("ROOT_STATIC_FOLDER")

func protectedWithPrivilege(Privilege Privilege, handler http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !checkPrivilege(r, Privilege) {
			http.Error(
				w,
				"User not authorized or not privilege",
				http.StatusUnauthorized,
			)
			return
		}

		handler(w, r)
	}
}

func ifRequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if settingConfig.RequireAuth {
			checkLogin(next).ServeHTTP(w, r)
		} else {
			next.ServeHTTP(w, r)
		}
	})
}

func main() {
	gob.Register(Session{})

	initializePrivilegeUsers()

	go statLogger()

	var err error

	store, err = redistore.NewRediStore(
		10,
		redisType,
		redisAddr,
		"",
		redisPass,
		[]byte(secretKey),
	)

	if err != nil {
		panic(err)
	}

	store.SetMaxAge(60 * 60 * 24 * 30)

	store.Options.HttpOnly = true

	defer store.Close()

	r := chi.NewRouter()

	r.Use(middleware.Logger)

	// CORS עבור GitHub Pages -> Render
	r.Use(corsMiddleware)

	r.Post(
		"/api/import/post",
		addNewPost,
	)

	r.Get(
		"/auth/google",
		getGoogleAuthValues,
	)

	r.Post(
		"/auth/login",
		login,
	)

	// כניסה באמצעות אימייל וסיסמה
	r.Post(
		"/auth/password-login",
		passwordLogin,
	)

	r.Post(
		"/auth/logout",
		logout,
	)

	r.Get(
		"/assets/favicon.ico",
		getFavicon,
	)

	r.Get(
		"/favicon.ico",
		getFavicon,
	)

	r.Group(func(r chi.Router) {

		r.Use(checkLogin)

		r.Post(
			"/api/reactions/set-reactions",
			setReactions,
		)

		r.Post(
			"/api/messages/report",
			reportMessage,
		)
	})

	r.Group(func(r chi.Router) {

		r.Use(ifRequireAuth)

		r.Get(
			"/firebase-messaging-sw.js",
			getFirebaseMessagingSW,
		)

		r.Route("/api", func(api chi.Router) {

			api.Get(
				"/ads/settings",
				getAdsSettings,
			)

			api.Get(
				"/emojis/list",
				getEmojisList,
			)

			api.Get(
				"/channel/notifications-config",
				getNotificationsConfig,
			)

			api.Post(
				"/channel/notifications-subscribe",
				subscribeNotifications,
			)

			api.Get(
				"/channel/info",
				getChannelInfo,
			)

			api.Get(
				"/messages",
				getMessages,
			)

			api.Get(
				"/events",
				getEvents,
			)

			api.Get(
				"/files/{fileid}",
				serveFile,
			)

			api.Get(
				"/user-info",
				getUserInfo,
			)

			api.Route("/admin", func(protected chi.Router) {

				// Writer
				protected.Post(
					"/new",
					protectedWithPrivilege(
						Writer,
						addMessage,
					),
				)

				protected.Post(
					"/edit-message",
					protectedWithPrivilege(
						Writer,
						updateMessage,
					),
				)

				protected.Get(
					"/delete-message/{id}",
					protectedWithPrivilege(
						Writer,
						deleteMessage,
					),
				)

				protected.Post(
					"/upload",
					protectedWithPrivilege(
						Writer,
						uploadFile,
					),
				)

				protected.Get(
					"/scheduled-messages/get",
					protectedWithPrivilege(
						Writer,
						getScheduledMessages,
					),
				)

				protected.Post(
					"/scheduled-messages/update",
					protectedWithPrivilege(
						Writer,
						updateScheduledMessages,
					)
				)

				// Moderator
				protected.Post(
					"/edit-channel-info",
					protectedWithPrivilege(
						Moderator,
						editChannelInfo,
					),
				)

				protected.Get(
					"/statistics",
					protectedWithPrivilege(
						Moderator,
						getStatistics,
					),
				)

				protected.Post(
					"/set-emojis",
					protectedWithPrivilege(
						Moderator,
						setEmojis,
					),
				)

				// Admin
				protected.Post(
					"/statistics/reset",
					protectedWithPrivilege(
						Admin,
						resetStatistics,
					),
				)

				protected.Get(
					"/privilegs-users/get-list",
					protectedWithPrivilege(
						Admin,
						getPrivilegeUsersList,
					),
				)

				protected.Post(
					"/privilegs-users/set",
					protectedWithPrivilege(
						Admin,
						setPrivilegeUsers,
					),
				)

				protected.Get(
					"/settings/get",
					protectedWithPrivilege(
						Admin,
						getSettings,
					),
				)

				protected.Post(
					"/settings/set",
					protectedWithPrivilege(
						Admin,
						setSettings,
					),
				)

				protected.Get(
					"/reports/get",
					protectedWithPrivilege(
						Admin,
						getReports,
					),
				)

				protected.Post(
					"/reports/set",
					protectedWithPrivilege(
						Admin,
						setReports,
					),
				)

				protected.Get(
					"/pending-users",
					protectedWithPrivilege(
						Admin,
						getPendingUsers,
					),
				)

				protected.Post(
					"/pending-users/approve",
					protectedWithPrivilege(
						Admin,
						approvePendingUser,
					),
				)

				protected.Post(
					"/pending-users/reject",
					protectedWithPrivilege(
						Admin,
						rejectPendingUser,
					),
				)
			})
		})
	})

	if settingConfig.RootStaticFolder != "" {

		r.Handle(
			"/assets/*",
			http.StripPrefix(
				"/assets/",
				http.FileServer(
					http.Dir(settingConfig.RootStaticFolder),
				),
			),
		)

		r.NotFound(
			serveSpaFile,
		)
	}

	go func() {
		log.Fatal(
			http.ListenAndServe(
				"localhost:6060",
				nil,
			),
		)
	}()

	port := os.Getenv("PORT")

	if port == "" {
		port = os.Getenv("SERVER_PORT")
	}

	if port == "" {
		port = "10000"
	}

	if err := http.ListenAndServe(
		"0.0.0.0:"+port,
		r,
	); err != nil {
		log.Fatal(err)
	}
}

func serveSpaFile(
	w http.ResponseWriter,
	r *http.Request,
) {

	htmlPath :=
		filepath.Join(
			settingConfig.RootStaticFolder,
			"index.html",
		)

	content, err :=
		os.ReadFile(htmlPath)

	if err != nil {

		http.Error(
			w,
			"File not found",
			http.StatusNotFound,
		)

		return
	}

	if settingConfig.CustomTitle != "" {

		content =
			bytes.ReplaceAll(
				content,
				[]byte("<title></title>"),
				[]byte(settingConfig.CustomTitle),
			)
	}

	w.Header().Set(
		"Content-Type",
		"text/html; charset=utf-8",
	)

	w.Write(content)
}
