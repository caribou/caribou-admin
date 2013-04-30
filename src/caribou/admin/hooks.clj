(ns caribou.admin.hooks
  (:require [caribou.model :as model :refer [create gather destroy]]))

(declare make-permissions-role
         remove-permissions-role
         make-permissions-model
         remove-permissions-model)

(defn init
  []
  (model/add-hook :model
                  :after_create
                  :make-permissions
                  make-permissions-model)
  (model/add-hook :model
                  :after_destroy
                  :remove-permissions
                  remove-permissions-model)
  (model/add-hook :account
                  :after_create
                  :make-permisisons
                  make-permissions-role)
  (model/add-hook :account
                  :after_destroy
                  :remove-permissions
                  remove-permissions-role))

(defn make-permissions-role
  "a hook to create a permission for a new row with an apropriate mask
  for every model"
  [{{role-id :id mask :default_mask} :content :as env}]
  (doseq [{model-id :id} @model/models]
    (create :permission {:model_id model-id :role_id role-id
                         :mask (or mask 0)}))
  env)

(defn remove-permissions-role
  "a hook to remove all permissions related to a role when the role is deleted"
  [{{role-id :id} :content :as env}]
  (let [perms (gather :permission {:where {:role_id role-id}})]
    (doseq [{id :id} perms]
      (destroy :permission id)))
  env)

(defn make-permissions-model
  "a hook to create a permission to a new model with an apropriate mask
  for every role"
  [{{model-id :id} :content :as env}]
  (let [roles (gather :role)]
    (doseq [{role-id :id mask :default_mask} roles]
      (create :permission {:model_id model-id :role_id role-id
                           :mask (or mask 0)})))
  env)

(defn remove-permissions-model
  "a hook to destroy all permissions tied to a model when it is deleted"
  [{{model-id :id} :content :as env}]
  (let [perms (gather :permission {:where {:model_id model-id}})]
    (doseq [{id :id} perms]
      (destroy :permission id)))
  env)
