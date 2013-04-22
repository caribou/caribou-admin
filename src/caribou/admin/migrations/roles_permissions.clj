(ns caribou.admin.roles-permissions
  (:require [caribou.model :as model :refer [create update destroy]]))

(defn migrate
  []
  (let [account-id (-> model/models deref :account :id)
        {perms-id
         :id} (create :model {:name "Permission"
                              :fields [{:name "Mask" :type "integer"}]})
        {role-id
         :id} (create :model {:name "Role"
                              :fields [{:name "Title" :type "string"}
                                       {:name "Permissions" :type "collection"
                                        :target_id perms-id}]})]
    (update :model account-id {:fields [{:name "Role" :type "part"
                                         :target_id role-id}]})))

(defn rollback
  []
  (let [perms-id (-> model/models deref :permission :id)
        role-id (-> model/models deref :role :id)]
    (destroy :model perms-id)
    (destroy :model role-id)))
