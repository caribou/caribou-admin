(ns caribou.admin.controllers.login
  (:use caribou.app.controller
        [caribou.app.pages :only [route-for]])
  (:require [caribou.model :as model]))

(import org.mindrot.jbcrypt.BCrypt)

(def nothing (constantly nil))

(defn hash-pw
  "hash a password to store it in the accounts db"
  [pass]
  (. BCrypt hashpw pass (. BCrypt gensalt 12)))

(defn check-pw
  "check a raw password against a hash from the accounts db"
  [pass hash]
  (. BCrypt checkpw pass hash))

(defn login
  [request]
  (render request))

(defn submit-login
  [request]
  (let [email (-> request :params :email)
        password (-> request :params :password)
        locale (or (-> request :params :locale) "en_US")
        target (or (-> request :params :target)
                   (route-for :admin.models {:locale locale :site "admin"}))
        account (model/pick :account {:where {:email email}})
        match? (and (seq password)
                    (seq (:crypted_password account))
                    (check-pw password (:crypted_password account)))
        target (if-not match?
                 (str (route-for :admin.login {:locale locale :site "admin"})
                      "&target=" target)
                 target)
        login (if match? "success" "failure")
        session (if-not match?
                  {}
                  {:user (dissoc account :created_at :updated_at)
                   :locale locale})]
    (println "USER in submit-login is " (:user session))
    (redirect target {:session session :login login})))


(defn create-login
  [request]
  (let [email (-> request :params :email)
        password (-> request :params :password)
        first (-> request :params :first)
        last (-> request :params :last)
        hash (hash-pw password)
        account (model/create :account {:email email
                                        :first_name first
                                        :last_name last
                                        :crypted_password hash})
        target (route-for :admin.new_account (select-keys request [:site :locale]))
        user (dissoc account :created_at :updated_at)]
    (redirect target {:session (:session request) :user user})))

;; allow target
(defn logout
  [request]
  (render request {:session {}}))

(defn forgot-password
  [request]
  (let [email (-> request :params :email)]
    ;; send a message to that email that lets them reset their pw
    (render request)))

(comment
  ;; here is a way to test out the create-login controller from the repl
  (caribou.model/db #(caribou.admin.controllers.login/create-login
                      {:params {:email "justin@weareinstrument.com"
                                :password "419truth"
                                :first "Justin"
                                :last "Lewis"}
                       :template (constantly "")})))

(comment
  (caribou.model/db #(caribou.admin.controllers.login/submit-login
                      {:params {:email "justin@weareinstrument.com"
                                :password "419truth"
                                :locale "en_US"}
                       :template (constantly "")})))


(comment
  (caribou.model/db #(caribou.admin.controllers.login/create-login
                      {:params {:email "phong@weareinstrument.com"
                                :password "3Ge5pm!N"
                                :first "Phong"
                                :last "Ho"}
                       :template (constantly "")})))

