(ns caribou.admin.controllers.settings.account
  (:use caribou.app.controller
        [cheshire.core :only (generate-string)]
        [caribou.app.pages :only [route-for]])
  (:require [caribou
             [model :as model]
             [auth :as auth]]
            [caribou.admin.rights :as rights]))

(def nothing (constantly nil))

(defn index
  [request]
  (render request))

(defn view
  [request]
  (render request))

(defn model-attribute
  [request]
  (render request))

(defn edit
  [request]
  (render request))

(defn update
  [request]
  (render request))

(defn destroy
  [request]
  (render request))

(defn login
  [request]
  (render request))

(defn submit-login
  [request]
  (let [email (-> request :params :email)
        password (-> request :params :password)
        locale (or (-> request :params :locale) "global")
        target (or (-> request :params :target)
                   (route-for :admin.models {:locale locale :site "admin"}))
        account (model/pick :account {:where {:email email}})
        match? (and (seq password)
                    (seq (:crypted-password account))
                    (auth/check-password password (:crypted-password account)))
        target (if-not match?
                 (str (route-for :admin.login {:locale locale :site "admin"})
                      "&target=" target)
                 target)
        login (if match? "success" "failure")
        session (:session request)
        session (if-not match?
                  session
                  (assoc session
                    :admin
                    {:user (dissoc account :created-at :updated-at)
                     :locale locale}))]
    (redirect target {:session session :login login})))

(defn new
  [request]
  (rights/with-permissions "settings/account/new" request
    (fn [[role-id perms :as permissions] request]
      (assert (rights/has-perms :account perms [:create] role-id))
      (let [roles (rights/gather permissions :role)]
        (render (assoc request :roles roles))))))

(defn create
  [{{email :email
     password :password
     first :first
     last :last
     role-id :role} :params
     :as request}]
  (rights/with-permissions "settings/account/create" request
    (fn [permissions request]
      (let [account (rights/create permissions
                                   :account {:email email
                                             :first-name first
                                             :last-name last
                                             :role-id role-id
                                             :password password})
            target (route-for :admin.new-account
                              (select-keys request [:site :locale]))
            user (dissoc account :created-at :updated-at)]
        (redirect target {:session (:session request) :user user})))))

;; allow target
(defn logout
  [request]
  (render request {:session (dissoc (:session request) :admin)}))

(defn forgot-password
  [request]
  (let [email (-> request :params :email)]
    ;; send a message to that email that lets them reset their pw
    (render request)))

(comment
  ;; here is a way to test out the create-login controller from the repl
  (caribou.admin.controllers.login/create-login
   {:params {:email "justin@weareinstrument.com"
             :password "419truth"
             :first "Justin"
             :last "Lewis"}
    :template (constantly "")}))

(comment
  (caribou.admin.controllers.login/submit-login
   {:params {:email "justin@weareinstrument.com"
             :password "419truth"
             :locale "en_US"}
    :template (constantly "")}))


(comment
  (caribou.admin.controllers.login/create-login
   {:params {:email "phong@weareinstrument.com"
             :password "3Ge5pm!N"
             :first "Phong"
             :last "Ho"}
    :template (constantly "")}))

