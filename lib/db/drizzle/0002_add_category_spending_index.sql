CREATE INDEX "transactions_user_type_date_idx" ON "transactions" USING btree ("user_id","type","date");
