(ns caribou.admin.migrations.roles-permissions
  (:require [caribou
             [config :as config]
             [model :as model :refer [create update destroy]]
             [permissions :as perms]]))

(defn make-models
  []
  (let [{{account-id :id} :account
         {model-id :id} :model} @model/models
         {perms-id
          :id} (create :model {:name "Permission"
                               :locked true
                               :fields [{:name "Mask" :type "integer"}
                                        {:name "Model" :type "part"
                                         :target_id model-id
                                         :reciprocal_name "Permissions"}]})
          {role-id
           :id} (create :model {:name "Role"
                                :locked true
                                :fields [{:name "Title" :type "string"}
                                         {:name "Default Mask" :type "integer"}
                                         {:name "Permissions" :type "collection"
                                          :target_id perms-id
                                          :reciprocal_name "Role"}]})]
    (update :model account-id {:fields [{:name "Role" :type "part"
                                         :target_id role-id}]})))

(defn apply-roles-perms
  []
  (let [{caribou-id
         :id} (model/pick :account {:where {:email "caribou"}})
        admin-mask (perms/mask :read :write :create :delete)
        model-ids (filter number? (keys @model/models))
        {admin-id
         :id} (create :role {:title "Admin"
                             :default_mask admin-mask
                             :permissions
                             (map (fn [id]
                                    (create :permission {:mask admin-mask
                                                         :model_id id}))
                                  model-ids)})]
    (update :account caribou-id {:role_id admin-id})))

(defn migrate
  []
  (config/init)
  (model/init)
  (make-models)
  (apply-roles-perms))

(defn rollback
  []
  (config/init)
  (model/init)
  (let [{{perms-id :id} :permission
         {role-id :id} :role} @model/models]
    (destroy :model perms-id)
    (destroy :model role-id)))

