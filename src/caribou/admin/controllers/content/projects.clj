(ns caribou.admin.controllers.content.projects
  (:use caribou.app.controller
        [clojure.string :only (join)])
  (:require [caribou
             [model :as model]
             [util :as util]
             [permissions :as permissions]]))

(defn next-page
  [current-page]
  (+ 1 (Integer/parseInt current-page)))

(defn active
  [a b attr]
  (if (= a b)
    (join (map (fn [[key val]] (str " " (name key) "=" val)) attr))))

(defn count-instances
  [table where-clause]
  (let [result (first (util/query "select count(id) from %1 where %2" (name table) where-clause))]
    (result (first (keys result)))))
    
(defn index
  [{{{user :user} :admin} :session
    {page :page} :params
    :as request}]
  (if-not (permissions/has user (@model/models :project) [:read])
    {:status 403
     :body "user does not have permission to view projects"}
    (let [limit 10
          offset (* limit (dec (Integer/parseInt (or page "1"))))
          projects (model/gather :project {:order {:id :asc}
                                           :where {:site_id 1}
                                           :limit limit
                                           :offset offset})  
          project-count (count-instances :project "1 = 1")
          published-project-count (count-instances :project "status = 1")
          draft-project-count (count-instances :project "status = 0")]
      (render (assoc request
                ;;:page page
                :projects projects
                :project-count project-count
                :published-project-count published-project-count
                :draft-project-count draft-project-count
                :active active
                :next-page next-page)))))

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