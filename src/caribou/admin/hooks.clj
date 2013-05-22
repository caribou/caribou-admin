(ns caribou.admin.hooks
  (:require [caribou.model :as model :refer [create gather destroy]]
            [caribou.hooks :as hooks]))

(defn make-permissions-role
  "a hook to create a permission for a new row with an apropriate mask
  for every model"
  [{{role-id :id mask :default-mask} :content :as env}]
  (doseq [{model-id :id} (gather :model)]
    (create :permission {:model-id model-id :role-id role-id
                         :mask (or mask 0)}))
  env)

(defn remove-permissions-role
  "a hook to remove all permissions related to a role when the role is deleted"
  [{{role-id :id} :content :as env}]
  (let [perms (gather :permission {:where {:role-id role-id}})]
    (doseq [{id :id} perms]
      (destroy :permission id)))
  env)

(defn make-permissions-model
  "a hook to create a permission to a new model with an apropriate mask
  for every role"
  [{{model-id :id} :content :as env}]
  (let [roles (gather :role)]
    (doseq [{role-id :id mask :default-mask} roles]
      (create :permission {:model-id model-id :role-id role-id
                           :mask (or mask 0)})))
  env)

(defn remove-permissions-model
  "a hook to destroy all permissions tied to a model when it is deleted"
  [{{model-id :id} :content :as env}]
  (let [perms (gather :permission {:where {:model-id model-id}})]
    (doseq [{id :id} perms]
      (destroy :permission id)))
  env)

(defn init
  []
  (hooks/add-hook :model
                  :after-create
                  :make-permissions
                  make-permissions-model)
  (hooks/add-hook :model
                  :after-destroy
                  :remove-permissions
                  remove-permissions-model)
  (hooks/add-hook :role
                  :after-create
                  :make-permisisons
                  make-permissions-role)
  (hooks/add-hook :role
                  :after-destroy
                  :remove-permissions
                  remove-permissions-role))

