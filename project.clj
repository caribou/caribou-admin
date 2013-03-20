(defproject antler/caribou-admin "0.9.10"
  :description "Generic admin tool for Caribou projects"
  :dependencies [[org.clojure/clojure "1.4.0"]
                 [antler/caribou-frontend "0.9.17"]
                 [antler/lichen "0.3.1"]
                 [clj-stacktrace "0.2.5"]
                 [swank-clojure "1.4.2" :exclusions [clj-stacktrace]]
                 [clj-time "0.4.4"]
                 [clucy "0.3.0"]
                 [org.mindrot/jbcrypt "0.3m"]]
  :jvm-opts ["-agentlib:jdwp=transport=dt_socket,server=y,suspend=n" "-Xmx2g"]
  :source-paths ["src" "../src"]
  :resource-paths ["resources/" "../resources/"]
  :ring {:handler caribou.admin.core/handler
         :servlet-name "caribou-admin"
         :init caribou.admin.core/init
         :open-browser? false
         :port 33773})
