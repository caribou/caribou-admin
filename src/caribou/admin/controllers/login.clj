(ns caribou.admin.controllers.login
  (:require [caribou
             [model :as model]
             [auth :as auth]]
            [caribou.app
             [controller :refer :all]
             [pages :refer [route-for]]]))

(def nothing (constantly nil))

(def hash-pw auth/hash-password)

(def check-pw auth/check-password)

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
                    (seq (:crypted_password account))
                    (check-pw password (:crypted_password account)))
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
                    {:user (dissoc account :created_at :updated_at)
                     :locale locale}))]
    (println "USER in submit-login is " (-> session :admin :user))
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
  (render request {:session (dissoc (:session request) :admin)}))

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

