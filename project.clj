(defproject caribou/caribou-admin "0.14.0"
  :description "Generic admin tool for Caribou projects"
  :dependencies [[org.clojure/clojure "1.5.1"]
                 [caribou/caribou-frontend "0.14.0"]
                 [clj-time "0.4.4"]]
  :jvm-opts ["-agentlib:jdwp=transport=dt_socket,server=y,suspend=n"
             "-Djava.awt.headless=true"
             "-Xmx2g"]
  :source-paths ["src" "../src"]
  :resource-paths ["resources/" "../resources/"]
  :plugins [[lein-ring "0.8.6"]
            [caribou/lein-caribou "2.14.0"]
            [lein-cljsbuild "1.0.2"
             :exclusions [fs]]]
  :ring {:handler caribou.admin.core/handler
         :servlet-name "caribou-admin"
         :init caribou.admin.core/init
         :open-browser? false
         :port 33773})
