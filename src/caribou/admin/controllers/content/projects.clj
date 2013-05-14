(ns caribou.admin.controllers.content.projects
  (:use caribou.app.controller
        [clojure.string :only (join)])
  (:require [caribou.admin.rights :as rights]
            [caribou.util :as util]))

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
  [request]
  (rights/with-permissions "content/projects/index" request
    (fn [permissions params]
      (let [limit 10
            offset (* limit (dec (Integer/parseInt (or (-> params :params :page) "1"))))
            projects (rights/gather permissions :project {:order {:id :asc} :where {:site-id 1} :limit limit :offset offset})
        project-count (count-instances :project "1 = 1")
        published-project-count (count-instances :project "status = 1")
        draft-project-count (count-instances :project "status = 0")]
    (render (assoc params
              ;;:page page
              :projects projects
              :project-count project-count
              :published-project-count published-project-count
              :draft-project-count draft-project-count
              :active active
              :next-page next-page))))))

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