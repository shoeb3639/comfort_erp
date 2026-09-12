# Indian city master data

The Indian city master is populated from `@countrystatecity/countries`, sourced from the Country State City Database by dr5hn.

The data is licensed under the Open Database License (ODbL) 1.0. Source: https://github.com/dr5hn/countries-states-cities-database

Run `npm run db:seed:cities` after applying migrations. The importer is idempotent and adds missing source records without deleting or overwriting application data.
