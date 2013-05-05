(ns caribou-admin.test.model-permissions
  (:require [clojure.test :refer [deftest testing is]]
            [caribou
             [model :as model]
             [config :as config]
             [permissions :as permissions]]
            [caribou.admin.controllers.content.models :as models-controller]))

(def requests
  {; :editor-for {} ;; deprecated?
   :editor-content {:params
                    {:site "admin",
                     :locale "global",
                     :action "editor-content",
                     :locale-code "",
                     :model "page"}}
   :editor-associated-content {:params
                               {:site "admin",
                                :locale "global",
                                :action "editor-associated-content",
                                :field "siphons",
                                :page "0",
                                :template "_paged_collection.html",
                                :id "1",
                                :model "page"}}
   :update-all {:params
                {:site "admin",
                 :locale "global",
                 "data" [{"model" "glurg",
                          "fields" {"mb",
                                    "jioefhj][ aq09ju 09 24t90uv6u40w"},
                          "opts" {}}],
                 :action "update-all"}}
   :reorder-all {:params
                 {:site "admin",
                  :locale "global",
                  "data" {"model" "page",
                          "association" "fields",
                          "id" 19,
                          "items"
                          [{"id" "272", "position" 1}
                           {"id" "278", "position" 2}
                           {"id" "273", "position" 3}
                           {"id" "274", "position" 4}
                           {"id" "275", "position" 5}
                           {"id" "276", "position" 6}
                           {"id" "277", "position" 7}
                           {"id" "279", "position" 8}
                           {"id" "292", "position" 9}]},
                  :action "reorder-all"}}
   :find-all {:params
              {:site "admin",
               :locale "global",
               :action "find-all",
               :model "page"}}
   :find-one {:params
              {:site "admin",
               :locale "global",
               :action "find-one",
               :slug "page",
               :include "fields",
               :model "page"}}
   :delete-all {:params
                {:site "admin",
                 :locale "global",
                 "data" [{"model" "field",
                          "id" "233"}],
                 :action "delete-all"}}
   :to-route {:params
              {:site "admin",
               :locale "global",
               :action "to-route",
               :slug "page",
               :page "admin.results"}}
   :upload-asset {}
   :remove-link {}
   :reindex {}
   :bulk-editor-content {}})

(defn do-caribou
  [fn]
  (config/init)
  (model/init)
  (model/db fn))

(def existing-roles
  []
  (set (doall (map :id (do-caribou (fn [] (model/gather :role)))))))

(defonce role-ids (atom []))

(defn make-user
  [mask]
  (let [{role-id :id} (model/impose :role {:default_mask mask})]
    (swap! role-ids conj role-id)
    role-id))

(defn cleanup
  [except]
  (doseq [id (remove existing-roles @role-ids]]
    (model/destroy :role id))
  (reset! role-ids []))

(deftest access
  (do-caribou
   (fn []
     (let [qa (make-user (permissions/mask :read))
           blogger (make-user (permissions/mask :write :read))
           editor (make-user (permissions/mask :write :read :create :delete))
           api models-controller/api]
       (is (= (api {:params {:action "editor-content"
                             :model "page"}
                    :session {:admin {:user {:role_id qa}}}})
              "error, tests unimplemented"))))))
