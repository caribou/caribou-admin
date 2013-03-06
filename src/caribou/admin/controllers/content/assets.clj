(ns caribou.admin.controllers.content.assets
  (:use caribou.app.controller))
  
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
  [request]
  (let [search (-> request params search)
        matches (model/gather :asset {:where search})]
    (render (merge {:assets matches} request))))