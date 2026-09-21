SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF SCHEMA_ID(N'workshop') IS NULL EXEC(N'CREATE SCHEMA workshop');
IF OBJECT_ID(N'workshop.users') IS NULL
BEGIN
  CREATE TABLE workshop.users(id varchar(36) NOT NULL PRIMARY KEY, name nvarchar(60) NOT NULL, login nvarchar(60) COLLATE Latin1_General_100_BIN2 NOT NULL UNIQUE, password varchar(128) NOT NULL, salt varchar(32) NOT NULL, role varchar(20) NOT NULL CHECK(role IN ('admin','participant')), created_at varchar(24) NOT NULL, last_seen varchar(24) NOT NULL);
  CREATE UNIQUE INDEX single_facilitator ON workshop.users(role) WHERE role='admin';
  CREATE TABLE workshop.sessions(token varchar(64) NOT NULL PRIMARY KEY,user_id varchar(36) NOT NULL REFERENCES workshop.users(id) ON DELETE CASCADE,csrf varchar(48) NOT NULL,expires bigint NOT NULL);
  CREATE INDEX sessions_expiry ON workshop.sessions(expires);
  CREATE TABLE workshop.progress(user_id varchar(36) NOT NULL REFERENCES workshop.users(id) ON DELETE CASCADE,revision varchar(64) NOT NULL,unit varchar(256) NOT NULL,status varchar(20) NOT NULL CHECK(status IN ('todo','done','blocked','deferred')),note nvarchar(1200) NOT NULL,updated_at varchar(24) NOT NULL,PRIMARY KEY(user_id,revision,unit));
  CREATE TABLE workshop.submissions(id varchar(36) NOT NULL PRIMARY KEY,user_id varchar(36) NOT NULL UNIQUE REFERENCES workshop.users(id) ON DELETE CASCADE,blob_name varchar(128) NOT NULL,image_bytes int NOT NULL,caption nvarchar(500) NOT NULL,consent bit NOT NULL,status varchar(24) NOT NULL CHECK(status IN ('pending','approved','changes-requested')),feedback nvarchar(1000) NOT NULL,created_at varchar(24) NOT NULL);
  CREATE TABLE workshop.kudos(user_id varchar(36) NOT NULL REFERENCES workshop.users(id),submission_id varchar(36) NOT NULL REFERENCES workshop.submissions(id) ON DELETE CASCADE,PRIMARY KEY(user_id,submission_id));
  CREATE TABLE workshop.settings([key] varchar(80) NOT NULL PRIMARY KEY,value varchar(80) NOT NULL,updated_at varchar(24) NOT NULL,updated_by varchar(36));
  CREATE TABLE workshop.audit(id bigint IDENTITY PRIMARY KEY,event varchar(80) NOT NULL,actor varchar(36),created_at varchar(24) NOT NULL);
  CREATE TABLE workshop.blob_cleanup(blob_name varchar(128) NOT NULL PRIMARY KEY,queued_at varchar(24) NOT NULL);
END;
IF OBJECT_ID(N'workshop.settings') IS NULL
  CREATE TABLE workshop.settings([key] varchar(80) NOT NULL PRIMARY KEY,value varchar(80) NOT NULL,updated_at varchar(24) NOT NULL,updated_by varchar(36));
COMMIT;