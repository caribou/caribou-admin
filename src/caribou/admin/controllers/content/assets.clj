(ns caribou.admin.controllers.content.assets
  (:use caribou.app.controller)
  (:require [caribou
             [model :as model]
             [permissions :as permissions]]))
  
(defn index
  [params]
  (render params))

(defn view
  [params]
  (render params))

(defn edit
  [params]
  (render params))

(defn create
  [params]
  (render params))

(defn update
  [params]
  (render params))

(defn destroy
  [params]
  (render params))

(defn modal-chooser
  [request]
  (render request))

(defn matches
  [{{search :search} :params
    {{user :user} :admin} :session
    :as request}]
  (if-not (permissions/has user (@model/models :asset) [:read])
    {:status 403
     :body "user does not have permission to view assets"}
    (let [search (-> request :params :search)
          matches (model/gather :asset {:where search})]
      (render (merge {:assets matches} request)))))

