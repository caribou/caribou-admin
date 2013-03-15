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
            [caribou.app.controller :as controller]))

(declare handler)

;; todo: put session in a cookie

(def base-helpers
  {:route-for (fn [slug params & additional]
                (pages/route-for slug (apply merge (cons params additional))))
   :equals =})

(defn reload-pages
  []
  (pages/create-page-routes
   (model/arrange-tree
    (model/db
     #(model/gather :page {:where {:site_id 2}})))))

(def open-pages
  #{"/login" "/logout" "/forgot-password" "/submit-login"})

(defn user-required
  [handler]
  (fn [request]
    ;;(println "REQUEST")
    ;;(clojure.pprint/pprint request)
    (if (or (contains? open-pages (:uri request))
            (seq (-> request :session :user)))
      (handler request)
      (controller/redirect (pages/route-for :login {})
                           {:session (:session request)}))))

(defn get-models
  [handler]
  (fn [request]
    (let [models (model/gather :model 
                               {:where {:locked false :join_model false}
                                :order {:id :asc}})]
      (handler (assoc request :user-models models)))))

(defn days-in-seconds
  [days]
  (* 60 60 24 days))

(defn provide-helpers
  [handler]
  (fn [request]
    (let [request (merge request base-helpers)]
      (handler request))))

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
        (provide-helpers)
        (lichen/wrap-lichen (@config/app :asset-dir))
        (user-required)
        (get-models)
        (handler/use-public-wrapper (@config/app :public-dir))
        (middleware/wrap-servlet-path-info)
        (request/wrap-request-map)
        (wrap-json-params)
        (wrap-multipart-params)
        (db/wrap-db @config/db)
        (compojure/api)
        (wrap-session {:store (cookie-store {:key "vEanzxBCC9xkQUoQ"})
                       :cookie-name "instrumentv3-newadmin-sess"
                       :cookie-attrs {:max-age (days-in-seconds 90)}})
        (wrap-cookies)))

  (swank/start-server :host "127.0.0.1" :port 4011))
