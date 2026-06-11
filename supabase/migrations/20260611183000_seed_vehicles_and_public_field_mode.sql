-- Import from VeiculosWWExport (1).xlsx.
-- Cód.Barras is the physical QR/barcode value used in the field.

WITH imported(codigo, qr_token, nome, modelo) AS (
  VALUES
    ('28', '0016', 'FROTA 16', 'CARRETA PRANCHA'),
    ('32', '0068', 'FROTA 68', 'CAMINHÃO PIPA'),
    ('31', '0070', 'FROTA 70', 'MOTONIVELADORA'),
    ('96', '0074', 'FROTA 74', 'ESCAVADEIRA HIDRAÚLICA'),
    ('33', '0084', 'FROTA 84', 'RETRO ESCAVADEIRA'),
    ('29', '0088', 'FROTA 88', 'MOTONIVELADORA'),
    ('30', '0090', 'FROTA 90', 'ROLO COMPACTADOR'),
    ('80', '0112', 'FROTA 112', 'CAMINHÃO'),
    ('34', '0118', 'FROTA 118', 'MINI ESCAVADEIRA'),
    ('35', '0122', 'FROTA 122', 'TRATOR DE ESTEIRAS'),
    ('36', '0124', 'FROTA 124', 'TRATOR VALTRA'),
    ('37', '0128', 'FROTA 128', 'TRATOR DE ESTEIRAS'),
    ('38', '0142', 'FROTA 142', 'CAMINHÃO PIPA'),
    ('39', '0156', 'FROTA 156', 'CARRETA PRANCHA'),
    ('40', '0164', 'FROTA 164', 'AUTOMÓVEL'),
    ('77', '0182', 'FROTA 182', 'CAMINHÃO PIPA'),
    ('41', '0192', 'FROTA 192', 'CAMINHÃO COMBOIO'),
    ('42', '0194', 'FROTA 194', 'ESCAVADEIRA HIDRAÚLICA'),
    ('43', '0200', 'FROTA 200', 'CARRETA PRANCHA'),
    ('44', '0204', 'FROTA 204', 'AUTOMÓVEL'),
    ('45', '0212', 'FROTA 212', 'AUTOMÓVEL'),
    ('46', '0214', 'FROTA 214', 'CAMINHÃO PIPA'),
    ('47', '0218', 'FROTA 218', 'AUTOMÓVEL'),
    ('48', '0228', 'FROTA 228', 'ESCAVADEIRA HIDRAÚLICA'),
    ('49', '0230', 'FROTA 230', 'ESCAVADEIRA HIDRAÚLICA'),
    ('50', '0232', 'FROTA 232', 'ESCAVADEIRA HIDRAÚLICA'),
    ('51', '0236', 'FROTA 236', 'ESCAVADEIRA HIDRAÚLICA'),
    ('52', '0238', 'FROTA 238', 'ESCAVADEIRA HIDRAÚLICA'),
    ('53', '0240', 'FROTA 240', 'MOTONIVELADORA'),
    ('54', '0242', 'FROTA 242', 'MOTONIVELADORA'),
    ('55', '0244', 'FROTA 244', 'ESCAVADEIRA HIDRAÚLICA'),
    ('56', '0248', 'FROTA 248', 'AUTOMÓVEL'),
    ('57', '0250', 'FROTA 250', 'ROLO COMPACTADOR'),
    ('58', '0254', 'FROTA 254', 'ROLO COMPACTADOR'),
    ('59', '0256', 'FROTA 256', 'ROLO COMPACTADOR'),
    ('60', '0258', 'FROTA 258', 'TRATOR JOHN DEERE'),
    ('61', '0260', 'FROTA 260', 'AUTOMÓVEL'),
    ('62', '0262', 'FROTA 262', 'CAMINHÃO COMBOIO'),
    ('63', '0264', 'FROTA 264', 'MOTONIVELADORA'),
    ('64', '0266', 'FROTA 266', 'CAMINHÃO PIPA'),
    ('65', '0268', 'FROTA 268', 'ESCAVADEIRA HIDRAÚLICA'),
    ('66', '0270', 'FROTA 270', 'MOTO BOMBA'),
    ('67', '0272', 'FROTA 272', 'AUTOMÓVEL'),
    ('68', '0274', 'FROTA 274', 'ROLO COMPACTADOR'),
    ('69', '0276', 'FROTA 276', 'AUTOMÓVEL'),
    ('70', '0278', 'FROTA 278', 'MOTO BOMBA'),
    ('71', '0280', 'FROTA 280', 'AUTOMÓVEL'),
    ('72', '0282', 'FROTA 282', 'TRATOR VALTRA'),
    ('73', '0284', 'FROTA 284', 'TRATOR VALTRA'),
    ('74', '0290', 'FROTA 290', 'MOTONIVELADORA'),
    ('75', '0292', 'FROTA 292', 'AUTOMÓVEL'),
    ('76', '0294', 'FROTA 294', 'AUTOMÓVEL'),
    ('89', '0296', 'FROTA 296', 'MOTO BOMBA'),
    ('84', '1', '1', 'OUTROS'),
    ('79', '1111', 'CB TESTE', 'BASCULANTE')
)
INSERT INTO public.machines (codigo, qr_token, nome, modelo, ativo)
SELECT codigo, qr_token, nome, modelo, TRUE
FROM imported
ON CONFLICT (codigo) DO UPDATE
SET qr_token = EXCLUDED.qr_token,
    nome = EXCLUDED.nome,
    modelo = EXCLUDED.modelo,
    ativo = TRUE,
    updated_at = now();

-- Field mode without required login.
ALTER TABLE public.shifts ALTER COLUMN operator_id DROP NOT NULL;
ALTER TABLE public.readings ALTER COLUMN operator_id DROP NOT NULL;

GRANT SELECT ON public.machines TO anon;
GRANT UPDATE (ultimo_horimetro) ON public.machines TO anon;
GRANT SELECT ON public.sites TO anon;
GRANT SELECT, INSERT, UPDATE ON public.shifts TO anon;
GRANT SELECT, INSERT, UPDATE ON public.readings TO anon;
GRANT INSERT ON public.audit_log TO anon;

INSERT INTO storage.buckets (id, name, public)
VALUES ('horimeter-photos', 'horimeter-photos', FALSE)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anon can read active machines"
  ON public.machines FOR SELECT TO anon
  USING (ativo = TRUE);

CREATE POLICY "Anon can update machine horimeter"
  ON public.machines FOR UPDATE TO anon
  USING (ativo = TRUE)
  WITH CHECK (ativo = TRUE);

CREATE POLICY "Anon can read active sites"
  ON public.sites FOR SELECT TO anon
  USING (ativo = TRUE);

CREATE POLICY "Anon manage anonymous shifts"
  ON public.shifts FOR ALL TO anon
  USING (operator_id IS NULL)
  WITH CHECK (operator_id IS NULL);

CREATE POLICY "Anon manage anonymous readings"
  ON public.readings FOR ALL TO anon
  USING (operator_id IS NULL)
  WITH CHECK (operator_id IS NULL);

CREATE POLICY "Anon insert audit without actor"
  ON public.audit_log FOR INSERT TO anon
  WITH CHECK (actor_id IS NULL);

CREATE POLICY "Anon upload field photos"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (
    bucket_id = 'horimeter-photos'
    AND (storage.foldername(name))[1] IN ('anonymous', 'api')
  );
