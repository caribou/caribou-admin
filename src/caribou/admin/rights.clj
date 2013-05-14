(ns caribou.admin.rights
  (:require [caribou
             [model :as model]
             [association :as assoc]
             [permissions :as permissions]]
            [slingshot.slingshot :refer [try+ throw+]]
            [clojure
             [set :as set]
             [string :as string]]))

(defn role-id [{{{{role-id :role-id} :user} :admin} :session}] role-id)

(defn itemize-by
  [k m]
  (->> m
       (group-by k)
       (map (fn [[k [v]]] [k v]))
       (into {})))

(defn all-permissions
 [request]
 (let [role-id (role-id request)
       {permissions
        :permissions} (model/pick
                       :role
                       {:where {:id role-id}
                        :include {:permissions {}}})
       permissions (itemize-by :model-id permissions)]
   [role-id permissions]))

(defn has-perms
  [model permissions actions role-id]
  (if (or (not model)
          (not permissions)
          (not actions)
          (not role-id))
    false
    (let [model (cond (map? model) (:id model)
                      (string? model) (-> model keyword (model/models) :id)
                      (keyword? model) (model/models model :id)
                      (number? model) model)
          required-mask (apply permissions/mask actions)
          permission (get permissions model)
          mask (or (:mask permission)
                   (:mask (model/pick :permission {:where {:role-id role-id
                                                           :model-id  model}}))
                   (:default-mask (model/pick :role {:where {:id role-id}}))
                   0)]
      (=  required-mask (bit-and required-mask mask)))))

(defn check-includes
  [model opts [role-id permissions] access]
  (let [model (model/models (keyword model))
        include (set (assoc/span-models-involved model opts []))
        all-included (set/union #{(:id model)} include)]
    (when-not (every? #(has-perms (model/models %) permissions access role-id)
                      all-included)
      (throw+ {:type :insufficient-permissions
               :message "insufficient perms to collect the requested data"}))))

(defn gather
  [permissions slug & [opts]]
  (check-includes slug opts permissions [:read])
  (model/gather slug opts))

(def pick (comp first gather))

(defn create
  [permissions & [slug fields opts :as args]]
  (check-includes slug opts permissions [:create :update])
  (apply model/create args))

(defn update
  [permissions slug id opts]
  (check-includes slug opts permissions [:write :create])
  (model/update slug id opts))

(defn destroy
  [[role-id permissions] slug id]
  (when-not (has-perms slug permissions [:destroy] role-id)
    (throw+ {:type :insufficient-permissions
             :message "insufficient perms to destroy the requested item"}))
  (model/destroy slug id))

(defn impose
  [permissions slug & [opts]]
  (check-includes slug opts permissions [:read :write :create])
  (model/impose slug opts))

(defn join [& args] (string/join \newline args))

(defn with-permissions
  [handler]
  (fn [request]
    (let [permissions (all-permissions request)
          request (assoc request :permissions permissions)]
      (try+ (handler request)
           (catch [:type :insufficient-permissions] {:keys [message]}
             {:status 403
              :body (str "insufficient permissions to perform this action.\n"
                         message \newline
                         (string/join \newline
                                      (:stack-trace &throw-context)))})))))
