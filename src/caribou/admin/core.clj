(ns caribou.admin.core
  (:use [ring.middleware.json-params :only (wrap-json-params)]
        [ring.middleware.multipart-params :only (wrap-multipart-params)]
        [ring.middleware.session :only (wrap-session)]
        [ring.middleware.cookies :only (wrap-cookies)]
        [ring.middleware.session.cookie :only (cookie-store)])
  (:require [compojure.handler :as compojure]
            [clojure.string :as string]
            [swank.swank :as swank]
            [lichen.core :as lichen]
            [caribou.config :as config]
            [caribou.db :as db]
            [caribou.model :as model]
            [caribou.app.i18n :as i18n]
            [caribou.app.pages :as pages]
            [caribou.app.template :as template]
            [caribou.app.halo :as halo]
            [caribou.app.middleware :as middleware]
            [caribou.app.request :as request]
            [caribou.app.handler :as handler]
            [caribou.app.controller :as controller]
            [caribou.admin.helpers :as helpers]
            [caribou.admin.routes :as routes]))

(declare handler)

;; todo: put session in a cookie

(def base-helpers
  {:route-for (fn [slug params & additional]
                (pages/route-for slug (apply merge (cons params additional))))
   :equals =})

(defn reload-pages
  []
  (pages/add-page-routes routes/admin-routes 'caribou.admin.controllers ""))

(defn open-page?
  [uri]
  (contains?
   #{(pages/route-for :login {})
     (pages/route-for :logout {})
     (pages/route-for :forgot_password {})
     (pages/route-for :submit_login {})}
   uri))

(defn user-required
  [handler]
  (fn [request]
    (if (or (seq (-> request :session :user))
            (open-page? (:uri request)))
      (handler request)
      (controller/redirect
       (pages/route-for :login {})
       {:session (:session request)}))))

(defn get-models
  [handler]
  (fn [request]
    (let [models (model/gather
                  :model
                  {:where {:locked false :join_model false}
                   :order {:id :asc}})]
      (handler (assoc request :user-models models)))))

(defn days-in-seconds
  [days]
  (* 60 60 24 days))

(defn provide-helpers
  [handler]
  (fn [request]
    (let [request (merge request base-helpers helpers/all)]
      (handler request))))


(defn admin-wrapper
  [handler]
  (-> handler
      (provide-helpers)
      (user-required)
      (get-models)))

(defn init
  []
  (config/init)
  (model/init)
  (i18n/init)
  (template/init)
  (reload-pages)
  (halo/init
   {:reload-pages reload-pages
    :halo-reset handler/reset-handler})
  (def handler
    (-> (handler/gen-handler)
        (admin-wrapper)
        (lichen/wrap-lichen (@config/app :asset-dir))
        (handler/use-public-wrapper (@config/app :public-dir))
        (middleware/wrap-servlet-path-info)
        (request/wrap-request-map)
        (wrap-json-params)
        (wrap-multipart-params)
        (db/wrap-db @config/db)
        (compojure/api)
        (wrap-session {:store (cookie-store {:key "vEanzxBCC9xkQUoQ"})
                       :cookie-name "caribou-admin-session"
                       :cookie-attrs {:max-age (days-in-seconds 90)}})
        (wrap-cookies)))

  (swank/start-server :host "127.0.0.1" :port 4011))
