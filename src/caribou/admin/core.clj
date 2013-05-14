(ns caribou.admin.core
  (:use [ring.middleware.json-params :only (wrap-json-params)]
        [ring.middleware.multipart-params :only (wrap-multipart-params)]
        [ring.middleware.params :only (wrap-params)]
        [ring.middleware.file :only (wrap-file)]
        [ring.middleware.head :only (wrap-head)]
        [ring.middleware.file-info :only (wrap-file-info)]
        [ring.middleware.resource :only (wrap-resource)]
        [ring.middleware.nested-params :only (wrap-nested-params)]
        [ring.middleware.keyword-params :only (wrap-keyword-params)]
        [ring.middleware.reload :only (wrap-reload)]
        [ring.middleware.session :only (wrap-session)]
        [ring.middleware.session.cookie :only (cookie-store)]
        [ring.middleware.cookies :only (wrap-cookies)]
        [ring.middleware.content-type :only (wrap-content-type)])
  (:require [clojure.string :as string]
            [swank.swank :as swank]
            [lichen.core :as lichen]
            [caribou
             [config :as config]
             [model :as model]
             [db :as db]
             [core :as caribou]]
            [caribou.app
             [core :as app]
             [i18n :as i18n]
             [pages :as pages]
             [template :as template]
             [middleware :as middleware]
             [request :as request]
             [handler :as handler]
             [controller :as controller]
             [helpers :as app-helpers]
             [config :as app-config]]
            [caribou.admin
             [rights :as rights]
             [helpers :as admin-helpers]
             [routes :as routes]
             [hooks :as hooks]]))

(declare handler)

(defn reload-pages
  []
  (pages/add-page-routes routes/admin-routes 'caribou.admin.controllers ""))

(defn open-page?
  [uri]
  (contains?
   #{(pages/route-for :admin.login {})
     (pages/route-for :admin.logout {})
     (pages/route-for :admin.forgot-password {})
     (pages/route-for :admin.submit-login {})}
   uri))

(defn user-required
  [handler]
  (fn [request]
    (if (or (seq (-> request :session :admin :user))
            (open-page? (:uri request)))
      (handler request)
      (controller/redirect
       (pages/route-for :admin.login {})))))

(defn get-models
  [handler]
  (fn [request]
    (let [order-fields (fn [model]
                         (update-in model
                                    [:fields]
                                    #(sort-by :position (vals %))))
          models (map order-fields (sort-by :id
                                            (model/local-models)))]
      (handler (assoc request :user-models models)))))

(defn days-in-seconds
  [days]
  (* 60 60 24 days))

(defn provide-helpers
  [handler]
  (fn [request]
    (let [request (merge request app-helpers/helpers admin-helpers/all)]
      (handler request))))

(defn admin-wrapper
  [handler]
  (-> handler
      (rights/with-permissions)
      (provide-helpers)
      (user-required)
      (get-models)))

(defn init
  []
  (let [config (app/environment-config)]
    (caribou/with-caribou config
      (reload-pages)
      (hooks/init)
      (def handler
        (-> (handler/handler #'reload-pages)
            (admin-wrapper)
            (wrap-reload)
            (wrap-file (config/draw :assets :dir))
            (wrap-resource (config/draw :app :public-dir))
            (wrap-file-info)
            (wrap-head)
            (lichen/wrap-lichen (config/draw :assets :dir))
            (middleware/wrap-servlet-path-info)
            (middleware/wrap-xhr-request)
            (request/wrap-request-map)
            (wrap-json-params)
            (wrap-multipart-params)
            (wrap-keyword-params)
            (wrap-nested-params)
            (wrap-params)
            (handler/wrap-caribou config)
            (wrap-session {:store (cookie-store {:key "vEanzxBCC9xkQUoQ"})
                           :cookie-name "caribou-admin-session"
                           :cookie-attrs {:max-age (days-in-seconds 90)}})
            (wrap-cookies)))

      (swank/start-server :host "127.0.0.1" :port 4011))))
