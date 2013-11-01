# caribou-admin

This project is the default admin interface for sites built using
caribou.

## Usage

To run the admin standalone, you need to check this project out

```bash
% git clone git@github.com:caribou/caribou-admin.git
```

Then create a config file in resource/config.  You most probably want
to name it _development.clj_ and have something like this in it:

```clj
{:database {:classname    "org.postgresql.Driver"
            :subprotocol  "postgresql"
            :host         "localhost"
            :database     "caribou_test"
            :user         "foo"
            :password     "bar"}
 :cache-templates :never
 :controller {:namespace "caribou.admin.controllers"}}
```
and then start it up:

```bash
% lein ring server
```

Generally, though, you will need to have a valid, existing Caribou database
to run the server standalone like this.  You will only really ever need
to do this if you are working on the Caribou admin project itself.

## License

Copyright © 2013 Instrument

Distributed under the Eclipse Public License, the same as Clojure.
