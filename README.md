# caribou-admin

This project is the default admin interface for sites built using
caribou.

## Usage

To run the admin standalone, you need to check this project out

   git clone git@github.com:antler/caribou-admin.git

Then create a config file in resource/config.  You most probably want
to name it _development.clj_ and have something like this in it:

  {:database {:classname    "org.postgresql.Driver"
              :subprotocol  "postgresql"
              :host         "localhost"
              :database     "caribou_test"
              :user         "foo"
              :password     "bar"}
   :cache-templates :never
   :controller {:namespace "caribou.admin.controllers"}}

and then start it up:

  lein ring server


## License

Copyright © 2013 Instrument

Distributed under the Eclipse Public License, the same as Clojure.
