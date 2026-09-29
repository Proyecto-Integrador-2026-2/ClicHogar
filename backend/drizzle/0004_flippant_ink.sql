CREATE TABLE "disponibilidad" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"dia_semana" smallint NOT NULL,
	"franja_horaria" varchar(20) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "disponibilidad" ADD CONSTRAINT "disponibilidad_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disponibilidad" ADD CONSTRAINT "disponibilidad_dia_check" CHECK ("dia_semana" BETWEEN 0 AND 6);--> statement-breakpoint
ALTER TABLE "disponibilidad" ADD CONSTRAINT "disponibilidad_franja_check" CHECK ("franja_horaria" IN ('manana', 'tarde', 'noche'));--> statement-breakpoint
CREATE UNIQUE INDEX "disponibilidad_usuario_dia_franja_uniq" ON "disponibilidad" USING btree ("usuario_id","dia_semana","franja_horaria");