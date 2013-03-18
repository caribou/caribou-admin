(ns caribou.admin.controllers.content.pages
  (:use caribou.app.controller
        [clojure.string :only (join)])
  (:require [caribou.model :as model]))

(defn add-level
  ([tree] (add-level tree 0))
  ([tree n] (map (fn [page] (assoc (update-in page [:children] #(add-level % (inc n))) :_level (join (repeat (* 5 n) "&nbsp;")))) tree)))

(defn index
  [params]
  (let [pages (model/gather :page
                            {:order {:id :asc}
                             :where {:site_id 1}})
        admin-pages (model/gather :page
                                  {:order {:id :asc}
                                   :where {:site_id 2}})
      
    page-tree
    (add-level (model/arrange-tree pages))
    
    admin-page-tree
    (add-level (model/arrange-tree admin-pages))
  
    ;; Add bindings to params
    modded-params
      (merge params
        { :pages page-tree }
        { :admin-pages admin-page-tree }
      )
  ]
  (render modded-params)))

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

(defn new
  [request]
  (render request))
