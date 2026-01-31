
-- Update all gram-based recipe ingredients with correct precision from CSV
-- Values are stored in kg (grams / 1000) with full decimal precision

-- 100% spelt (e184383c-7ed0-4287-b541-9d7770ae5afb)
UPDATE public.recipe_ingredients SET quantity = 0.265 WHERE product_id = 'e184383c-7ed0-4287-b541-9d7770ae5afb' AND ingredient_id = 'c3cd8b19-3d42-4ed9-ba74-c213d24f0801'; -- Speltbloem 265g
UPDATE public.recipe_ingredients SET quantity = 0.008 WHERE product_id = 'e184383c-7ed0-4287-b541-9d7770ae5afb' AND ingredient_id = 'b7ce3c26-5a57-4815-94d6-5c8b24fa13ed'; -- Zout 8g
UPDATE public.recipe_ingredients SET quantity = 0.088 WHERE product_id = 'e184383c-7ed0-4287-b541-9d7770ae5afb' AND ingredient_id = 'c41fb1d4-0958-4fc4-910f-1af5565e7b40'; -- Speltdesem 88g
UPDATE public.recipe_ingredients SET quantity = 0.177 WHERE product_id = 'e184383c-7ed0-4287-b541-9d7770ae5afb' AND ingredient_id = 'a4c26d86-9d90-49c9-b7fe-9ed9f69b4979'; -- Speltmeel 177g
UPDATE public.recipe_ingredients SET quantity = 0.265 WHERE product_id = 'e184383c-7ed0-4287-b541-9d7770ae5afb' AND ingredient_id = 'c78aaf1f-c447-43f5-abc2-fef94cf81df5'; -- Water 265g

-- Citroentijm cake (cfc5e45b-2f50-49ca-8b6a-91e5740475dd)
UPDATE public.recipe_ingredients SET quantity = 0.100 WHERE product_id = 'cfc5e45b-2f50-49ca-8b6a-91e5740475dd' AND ingredient_id = '2dfd8f81-7474-42b6-8258-c1258171c62e'; -- Kristalsuiker 100g
UPDATE public.recipe_ingredients SET quantity = 0.055 WHERE product_id = 'cfc5e45b-2f50-49ca-8b6a-91e5740475dd' AND ingredient_id = 'ad34109f-a18d-4c79-a30a-aa98fedbd461'; -- Olijfolie 55g
UPDATE public.recipe_ingredients SET quantity = 0.090 WHERE product_id = 'cfc5e45b-2f50-49ca-8b6a-91e5740475dd' AND ingredient_id = '7e255045-c525-4247-a787-be9415f4946b'; -- Yoghurt 90g
UPDATE public.recipe_ingredients SET quantity = 0.095 WHERE product_id = 'cfc5e45b-2f50-49ca-8b6a-91e5740475dd' AND ingredient_id = '13ba6467-25f4-4566-b102-8044bce656f4'; -- Franse tarwebloem 95g
UPDATE public.recipe_ingredients SET quantity = 0.002 WHERE product_id = 'cfc5e45b-2f50-49ca-8b6a-91e5740475dd' AND ingredient_id = 'bed4f564-719f-415f-8fca-6ca9bd649536'; -- Baking Powder 2g
UPDATE public.recipe_ingredients SET quantity = 0.0005 WHERE product_id = 'cfc5e45b-2f50-49ca-8b6a-91e5740475dd' AND ingredient_id = 'b7ce3c26-5a57-4815-94d6-5c8b24fa13ed'; -- Zout 0.5g
UPDATE public.recipe_ingredients SET quantity = 0.025 WHERE product_id = 'cfc5e45b-2f50-49ca-8b6a-91e5740475dd' AND ingredient_id = '9ebfb286-85f9-4577-af76-dc275b27dd9b'; -- Poedersuiker 25g

-- Donker pompoen (781386a4-86c5-4a2b-98df-9c5a5d1ae30e)
UPDATE public.recipe_ingredients SET quantity = 0.135 WHERE product_id = '781386a4-86c5-4a2b-98df-9c5a5d1ae30e' AND ingredient_id = '951b0ded-3578-4309-9644-d4aa7f518cf4'; -- Tarwebloem 135g
UPDATE public.recipe_ingredients SET quantity = 0.009 WHERE product_id = '781386a4-86c5-4a2b-98df-9c5a5d1ae30e' AND ingredient_id = 'b7ce3c26-5a57-4815-94d6-5c8b24fa13ed'; -- Zout 9g
UPDATE public.recipe_ingredients SET quantity = 0.009 WHERE product_id = '781386a4-86c5-4a2b-98df-9c5a5d1ae30e' AND ingredient_id = '5de97e39-dd7b-4363-bb1b-2e0a88dd4af7'; -- Gerstmeel 9g
UPDATE public.recipe_ingredients SET quantity = 0.306 WHERE product_id = '781386a4-86c5-4a2b-98df-9c5a5d1ae30e' AND ingredient_id = '1a471085-952c-4ce6-91f2-323cae4a3c88'; -- Tarwemeel 306g
UPDATE public.recipe_ingredients SET quantity = 0.090 WHERE product_id = '781386a4-86c5-4a2b-98df-9c5a5d1ae30e' AND ingredient_id = '58781af5-4dd9-4a90-b70b-30ac63657dd0'; -- Desem 90g
UPDATE public.recipe_ingredients SET quantity = 0.306 WHERE product_id = '781386a4-86c5-4a2b-98df-9c5a5d1ae30e' AND ingredient_id = 'c78aaf1f-c447-43f5-abc2-fef94cf81df5'; -- Water 306g
UPDATE public.recipe_ingredients SET quantity = 0.090 WHERE product_id = '781386a4-86c5-4a2b-98df-9c5a5d1ae30e' AND ingredient_id = '5fd88646-453a-48a7-87cf-05a6905b65c0'; -- Pompoenpitten 90g

-- Donker tarwebrood (e0bfa6a7-87d2-4dbe-9635-954f652229f7)
UPDATE public.recipe_ingredients SET quantity = 0.135 WHERE product_id = 'e0bfa6a7-87d2-4dbe-9635-954f652229f7' AND ingredient_id = '951b0ded-3578-4309-9644-d4aa7f518cf4'; -- Tarwebloem 135g
UPDATE public.recipe_ingredients SET quantity = 0.306 WHERE product_id = 'e0bfa6a7-87d2-4dbe-9635-954f652229f7' AND ingredient_id = '1a471085-952c-4ce6-91f2-323cae4a3c88'; -- Tarwemeel 306g
UPDATE public.recipe_ingredients SET quantity = 0.009 WHERE product_id = 'e0bfa6a7-87d2-4dbe-9635-954f652229f7' AND ingredient_id = '5de97e39-dd7b-4363-bb1b-2e0a88dd4af7'; -- Gerstmeel 9g
UPDATE public.recipe_ingredients SET quantity = 0.306 WHERE product_id = 'e0bfa6a7-87d2-4dbe-9635-954f652229f7' AND ingredient_id = 'c78aaf1f-c447-43f5-abc2-fef94cf81df5'; -- Water 306g
UPDATE public.recipe_ingredients SET quantity = 0.090 WHERE product_id = 'e0bfa6a7-87d2-4dbe-9635-954f652229f7' AND ingredient_id = '58781af5-4dd9-4a90-b70b-30ac63657dd0'; -- Desem 90g
UPDATE public.recipe_ingredients SET quantity = 0.009 WHERE product_id = 'e0bfa6a7-87d2-4dbe-9635-954f652229f7' AND ingredient_id = 'b7ce3c26-5a57-4815-94d6-5c8b24fa13ed'; -- Zout 9g

-- Donker walnoten (4f282822-628f-4cdb-a89c-df3686e597d3)
UPDATE public.recipe_ingredients SET quantity = 0.135 WHERE product_id = '4f282822-628f-4cdb-a89c-df3686e597d3' AND ingredient_id = '951b0ded-3578-4309-9644-d4aa7f518cf4'; -- Tarwebloem 135g
UPDATE public.recipe_ingredients SET quantity = 0.306 WHERE product_id = '4f282822-628f-4cdb-a89c-df3686e597d3' AND ingredient_id = '1a471085-952c-4ce6-91f2-323cae4a3c88'; -- Tarwemeel 306g
UPDATE public.recipe_ingredients SET quantity = 0.009 WHERE product_id = '4f282822-628f-4cdb-a89c-df3686e597d3' AND ingredient_id = 'b7ce3c26-5a57-4815-94d6-5c8b24fa13ed'; -- Zout 9g
UPDATE public.recipe_ingredients SET quantity = 0.090 WHERE product_id = '4f282822-628f-4cdb-a89c-df3686e597d3' AND ingredient_id = '58781af5-4dd9-4a90-b70b-30ac63657dd0'; -- Desem 90g
UPDATE public.recipe_ingredients SET quantity = 0.009 WHERE product_id = '4f282822-628f-4cdb-a89c-df3686e597d3' AND ingredient_id = '5de97e39-dd7b-4363-bb1b-2e0a88dd4af7'; -- Gerstmeel 9g
UPDATE public.recipe_ingredients SET quantity = 0.306 WHERE product_id = '4f282822-628f-4cdb-a89c-df3686e597d3' AND ingredient_id = 'c78aaf1f-c447-43f5-abc2-fef94cf81df5'; -- Water 306g
UPDATE public.recipe_ingredients SET quantity = 0.075 WHERE product_id = '4f282822-628f-4cdb-a89c-df3686e597d3' AND ingredient_id = '39122805-b992-4bae-a30e-172196264a17'; -- Walnoten 75g

-- Donker zonnebloem (211355dc-4245-4bc8-9a21-5e77b33ee33f)
UPDATE public.recipe_ingredients SET quantity = 0.220 WHERE product_id = '211355dc-4245-4bc8-9a21-5e77b33ee33f' AND ingredient_id = '951b0ded-3578-4309-9644-d4aa7f518cf4'; -- Tarwebloem 220g
UPDATE public.recipe_ingredients SET quantity = 0.220 WHERE product_id = '211355dc-4245-4bc8-9a21-5e77b33ee33f' AND ingredient_id = '1a471085-952c-4ce6-91f2-323cae4a3c88'; -- Tarwemeel 220g
UPDATE public.recipe_ingredients SET quantity = 0.009 WHERE product_id = '211355dc-4245-4bc8-9a21-5e77b33ee33f' AND ingredient_id = '5de97e39-dd7b-4363-bb1b-2e0a88dd4af7'; -- Gerstmeel 9g
UPDATE public.recipe_ingredients SET quantity = 0.306 WHERE product_id = '211355dc-4245-4bc8-9a21-5e77b33ee33f' AND ingredient_id = 'c78aaf1f-c447-43f5-abc2-fef94cf81df5'; -- Water 306g
UPDATE public.recipe_ingredients SET quantity = 0.090 WHERE product_id = '211355dc-4245-4bc8-9a21-5e77b33ee33f' AND ingredient_id = '58781af5-4dd9-4a90-b70b-30ac63657dd0'; -- Desem 90g
UPDATE public.recipe_ingredients SET quantity = 0.009 WHERE product_id = '211355dc-4245-4bc8-9a21-5e77b33ee33f' AND ingredient_id = 'b7ce3c26-5a57-4815-94d6-5c8b24fa13ed'; -- Zout 9g
UPDATE public.recipe_ingredients SET quantity = 0.075 WHERE product_id = '211355dc-4245-4bc8-9a21-5e77b33ee33f' AND ingredient_id = '18540735-936e-4750-a227-af7d2ea5e9c1'; -- Zonnebloempitten 75g

-- Granola (624c16dc-5057-4b5d-bd2e-ae330cb8d571)
UPDATE public.recipe_ingredients SET quantity = 0.267 WHERE product_id = '624c16dc-5057-4b5d-bd2e-ae330cb8d571' AND ingredient_id = 'f60068d8-fb4d-49cb-8dbd-bd46fd08e8d0'; -- Havervlokken 267g
UPDATE public.recipe_ingredients SET quantity = 0.067 WHERE product_id = '624c16dc-5057-4b5d-bd2e-ae330cb8d571' AND ingredient_id = '0f3272b6-5f7b-4e39-9c54-0bad20628117'; -- Amandelen 67g
UPDATE public.recipe_ingredients SET quantity = 0.033 WHERE product_id = '624c16dc-5057-4b5d-bd2e-ae330cb8d571' AND ingredient_id = '39122805-b992-4bae-a30e-172196264a17'; -- Walnoten 33g
UPDATE public.recipe_ingredients SET quantity = 0.033 WHERE product_id = '624c16dc-5057-4b5d-bd2e-ae330cb8d571' AND ingredient_id = '1432fc86-26d9-4bc0-b087-96053cacaa66'; -- Hazelnoten 33g
UPDATE public.recipe_ingredients SET quantity = 0.050 WHERE product_id = '624c16dc-5057-4b5d-bd2e-ae330cb8d571' AND ingredient_id = '8294b02b-6e5b-4eb4-915e-4de8e5da31b4'; -- Eiwit 50g
UPDATE public.recipe_ingredients SET quantity = 0.015 WHERE product_id = '624c16dc-5057-4b5d-bd2e-ae330cb8d571' AND ingredient_id = '8c5f0f12-0a26-41b9-b2ec-2f841e843b69'; -- Kaneel 15g

-- Licht pestobrood (3bfe64d1-13b3-4e80-bd37-06d3a8541130)
UPDATE public.recipe_ingredients SET quantity = 0.360 WHERE product_id = '3bfe64d1-13b3-4e80-bd37-06d3a8541130' AND ingredient_id = '951b0ded-3578-4309-9644-d4aa7f518cf4'; -- Tarwebloem 360g
UPDATE public.recipe_ingredients SET quantity = 0.2925 WHERE product_id = '3bfe64d1-13b3-4e80-bd37-06d3a8541130' AND ingredient_id = 'c78aaf1f-c447-43f5-abc2-fef94cf81df5'; -- Water 292.5g
UPDATE public.recipe_ingredients SET quantity = 0.009 WHERE product_id = '3bfe64d1-13b3-4e80-bd37-06d3a8541130' AND ingredient_id = 'b7ce3c26-5a57-4815-94d6-5c8b24fa13ed'; -- Zout 9g
UPDATE public.recipe_ingredients SET quantity = 0.081 WHERE product_id = '3bfe64d1-13b3-4e80-bd37-06d3a8541130' AND ingredient_id = '1a471085-952c-4ce6-91f2-323cae4a3c88'; -- Tarwemeel 81g
UPDATE public.recipe_ingredients SET quantity = 0.090 WHERE product_id = '3bfe64d1-13b3-4e80-bd37-06d3a8541130' AND ingredient_id = '58781af5-4dd9-4a90-b70b-30ac63657dd0'; -- Desem 90g
UPDATE public.recipe_ingredients SET quantity = 0.009 WHERE product_id = '3bfe64d1-13b3-4e80-bd37-06d3a8541130' AND ingredient_id = '5de97e39-dd7b-4363-bb1b-2e0a88dd4af7'; -- Gerstmeel 9g
UPDATE public.recipe_ingredients SET quantity = 0.027 WHERE product_id = '3bfe64d1-13b3-4e80-bd37-06d3a8541130' AND ingredient_id = '94cb38a4-7f85-44ad-aa4e-05b107af24f3'; -- Verse basilicum 27g

-- Licht tarwebrood (561d513e-57b4-40f6-bb99-b5d347052ca1)
UPDATE public.recipe_ingredients SET quantity = 0.360 WHERE product_id = '561d513e-57b4-40f6-bb99-b5d347052ca1' AND ingredient_id = '951b0ded-3578-4309-9644-d4aa7f518cf4'; -- Tarwebloem 360g
UPDATE public.recipe_ingredients SET quantity = 0.081 WHERE product_id = '561d513e-57b4-40f6-bb99-b5d347052ca1' AND ingredient_id = '1a471085-952c-4ce6-91f2-323cae4a3c88'; -- Tarwemeel 81g
UPDATE public.recipe_ingredients SET quantity = 0.009 WHERE product_id = '561d513e-57b4-40f6-bb99-b5d347052ca1' AND ingredient_id = '5de97e39-dd7b-4363-bb1b-2e0a88dd4af7'; -- Gerstmeel 9g
UPDATE public.recipe_ingredients SET quantity = 0.2925 WHERE product_id = '561d513e-57b4-40f6-bb99-b5d347052ca1' AND ingredient_id = 'c78aaf1f-c447-43f5-abc2-fef94cf81df5'; -- Water 292.5g
UPDATE public.recipe_ingredients SET quantity = 0.090 WHERE product_id = '561d513e-57b4-40f6-bb99-b5d347052ca1' AND ingredient_id = '58781af5-4dd9-4a90-b70b-30ac63657dd0'; -- Desem 90g
UPDATE public.recipe_ingredients SET quantity = 0.009 WHERE product_id = '561d513e-57b4-40f6-bb99-b5d347052ca1' AND ingredient_id = 'b7ce3c26-5a57-4815-94d6-5c8b24fa13ed'; -- Zout 9g

-- Millionaire's Shortbread (ff6b1fc6-3c44-4abe-8177-5e30b6ce61a6)
UPDATE public.recipe_ingredients SET quantity = 0.025 WHERE product_id = 'ff6b1fc6-3c44-4abe-8177-5e30b6ce61a6' AND ingredient_id = '2dfd8f81-7474-42b6-8258-c1258171c62e'; -- Kristalsuiker 25g
UPDATE public.recipe_ingredients SET quantity = 0.075 WHERE product_id = 'ff6b1fc6-3c44-4abe-8177-5e30b6ce61a6' AND ingredient_id = '13ba6467-25f4-4566-b102-8044bce656f4'; -- Franse tarwebloem 75g
UPDATE public.recipe_ingredients SET quantity = 0.100 WHERE product_id = 'ff6b1fc6-3c44-4abe-8177-5e30b6ce61a6' AND ingredient_id = 'bca865a3-be25-4e5e-acb4-41796e69b3ce'; -- Gecondenseerde melk 100g
UPDATE public.recipe_ingredients SET quantity = 0.0125 WHERE product_id = 'ff6b1fc6-3c44-4abe-8177-5e30b6ce61a6' AND ingredient_id = '3c4c00e0-362d-4f63-ab47-7430c375cdf1'; -- Witte basterdsuiker 12.5g
UPDATE public.recipe_ingredients SET quantity = 0.0125 WHERE product_id = 'ff6b1fc6-3c44-4abe-8177-5e30b6ce61a6' AND ingredient_id = 'bb7c5c60-34a2-4890-88ef-59195ab373db'; -- Lichtbruine suiker 12.5g
UPDATE public.recipe_ingredients SET quantity = 0.050 WHERE product_id = 'ff6b1fc6-3c44-4abe-8177-5e30b6ce61a6' AND ingredient_id = '0cabd11c-20fe-4016-84ab-651b7b5c46b2'; -- Donkere chocolade 50g
UPDATE public.recipe_ingredients SET quantity = 0.0075 WHERE product_id = 'ff6b1fc6-3c44-4abe-8177-5e30b6ce61a6' AND ingredient_id = 'abeabd62-bcf3-43ce-9ddf-8adecad6cdbd'; -- Witte chocolade 7.5g

-- Speculoos cookies (a4923da7-9523-463c-9458-256f4adb09ae)
UPDATE public.recipe_ingredients SET quantity = 0.0125 WHERE product_id = 'a4923da7-9523-463c-9458-256f4adb09ae' AND ingredient_id = 'f4859756-1d1d-4ad9-b7d5-9d37e9ae4c8b'; -- Boter 12.5g
UPDATE public.recipe_ingredients SET quantity = 0.0075 WHERE product_id = 'a4923da7-9523-463c-9458-256f4adb09ae' AND ingredient_id = 'a507da66-b8b1-4296-b311-e31e1c160c31'; -- Speculoos 7.5g
UPDATE public.recipe_ingredients SET quantity = 0.0125 WHERE product_id = 'a4923da7-9523-463c-9458-256f4adb09ae' AND ingredient_id = 'bb7c5c60-34a2-4890-88ef-59195ab373db'; -- Lichtbruine suiker 12.5g
UPDATE public.recipe_ingredients SET quantity = 0.0063 WHERE product_id = 'a4923da7-9523-463c-9458-256f4adb09ae' AND ingredient_id = '2dfd8f81-7474-42b6-8258-c1258171c62e'; -- Kristalsuiker 6.3g
UPDATE public.recipe_ingredients SET quantity = 0.0188 WHERE product_id = 'a4923da7-9523-463c-9458-256f4adb09ae' AND ingredient_id = '13ba6467-25f4-4566-b102-8044bce656f4'; -- Franse tarwebloem 18.8g
UPDATE public.recipe_ingredients SET quantity = 0.0003 WHERE product_id = 'a4923da7-9523-463c-9458-256f4adb09ae' AND ingredient_id = 'c1ddc5b4-bdb3-4076-a071-f04790861920'; -- Baking Soda 0.3g
UPDATE public.recipe_ingredients SET quantity = 0.0003 WHERE product_id = 'a4923da7-9523-463c-9458-256f4adb09ae' AND ingredient_id = 'bed4f564-719f-415f-8fca-6ca9bd649536'; -- Baking Powder 0.3g
UPDATE public.recipe_ingredients SET quantity = 0.0003 WHERE product_id = 'a4923da7-9523-463c-9458-256f4adb09ae' AND ingredient_id = 'b7ce3c26-5a57-4815-94d6-5c8b24fa13ed'; -- Zout 0.3g
UPDATE public.recipe_ingredients SET quantity = 0.015 WHERE product_id = 'a4923da7-9523-463c-9458-256f4adb09ae' AND ingredient_id = 'abeabd62-bcf3-43ce-9ddf-8adecad6cdbd'; -- Witte chocolade 15g
UPDATE public.recipe_ingredients SET quantity = 0.0075 WHERE product_id = 'a4923da7-9523-463c-9458-256f4adb09ae' AND ingredient_id = '1432fc86-26d9-4bc0-b087-96053cacaa66'; -- Hazelnoten 7.5g
UPDATE public.recipe_ingredients SET quantity = 0.0003 WHERE product_id = 'a4923da7-9523-463c-9458-256f4adb09ae' AND ingredient_id = 'a8e706bb-9e42-4a6d-9624-6f60ff3ca5e0'; -- Vanille 0.3g

-- Tripple Choc cookies (e32789d1-d573-4fd5-a641-ef2cbef7ceab)
UPDATE public.recipe_ingredients SET quantity = 0.0222 WHERE product_id = 'e32789d1-d573-4fd5-a641-ef2cbef7ceab' AND ingredient_id = '13ba6467-25f4-4566-b102-8044bce656f4'; -- Franse tarwebloem 22.2g
UPDATE public.recipe_ingredients SET quantity = 0.0031 WHERE product_id = 'e32789d1-d573-4fd5-a641-ef2cbef7ceab' AND ingredient_id = '26c1dbf6-8c55-4359-89ad-a6c5a5d249ce'; -- Cacaopoeder 3.1g
UPDATE public.recipe_ingredients SET quantity = 0.0005 WHERE product_id = 'e32789d1-d573-4fd5-a641-ef2cbef7ceab' AND ingredient_id = 'bed4f564-719f-415f-8fca-6ca9bd649536'; -- Baking Powder 0.5g
UPDATE public.recipe_ingredients SET quantity = 0.0004 WHERE product_id = 'e32789d1-d573-4fd5-a641-ef2cbef7ceab' AND ingredient_id = 'c1ddc5b4-bdb3-4076-a071-f04790861920'; -- Baking Soda 0.4g
UPDATE public.recipe_ingredients SET quantity = 0.0002 WHERE product_id = 'e32789d1-d573-4fd5-a641-ef2cbef7ceab' AND ingredient_id = 'b7ce3c26-5a57-4815-94d6-5c8b24fa13ed'; -- Zout 0.2g
UPDATE public.recipe_ingredients SET quantity = 0.0003 WHERE product_id = 'e32789d1-d573-4fd5-a641-ef2cbef7ceab' AND ingredient_id = 'd43ccee1-e982-4eda-ac97-20b8cb34c9a8'; -- Maizena 0.3g
UPDATE public.recipe_ingredients SET quantity = 0.0003 WHERE product_id = 'e32789d1-d573-4fd5-a641-ef2cbef7ceab' AND ingredient_id = '66fe6db3-f7c9-40c6-b5d5-76e9675fb6a5'; -- Espressopoeder 0.3g
UPDATE public.recipe_ingredients SET quantity = 0.0142 WHERE product_id = 'e32789d1-d573-4fd5-a641-ef2cbef7ceab' AND ingredient_id = 'f4859756-1d1d-4ad9-b7d5-9d37e9ae4c8b'; -- Boter 14.2g
UPDATE public.recipe_ingredients SET quantity = 0.0125 WHERE product_id = 'e32789d1-d573-4fd5-a641-ef2cbef7ceab' AND ingredient_id = 'bb7c5c60-34a2-4890-88ef-59195ab373db'; -- Lichtbruine suiker 12.5g
UPDATE public.recipe_ingredients SET quantity = 0.0075 WHERE product_id = 'e32789d1-d573-4fd5-a641-ef2cbef7ceab' AND ingredient_id = '2dfd8f81-7474-42b6-8258-c1258171c62e'; -- Kristalsuiker 7.5g
UPDATE public.recipe_ingredients SET quantity = 0.0094 WHERE product_id = 'e32789d1-d573-4fd5-a641-ef2cbef7ceab' AND ingredient_id = 'abeabd62-bcf3-43ce-9ddf-8adecad6cdbd'; -- Witte chocolade 9.4g
UPDATE public.recipe_ingredients SET quantity = 0.0094 WHERE product_id = 'e32789d1-d573-4fd5-a641-ef2cbef7ceab' AND ingredient_id = '0cabd11c-20fe-4016-84ab-651b7b5c46b2'; -- Donkere chocolade 9.4g

-- Wit tarwebrood (18efb40f-0f8a-42a5-8313-9097eec4f518)
UPDATE public.recipe_ingredients SET quantity = 0.440 WHERE product_id = '18efb40f-0f8a-42a5-8313-9097eec4f518' AND ingredient_id = '951b0ded-3578-4309-9644-d4aa7f518cf4'; -- Tarwebloem 440g
UPDATE public.recipe_ingredients SET quantity = 0.135 WHERE product_id = '18efb40f-0f8a-42a5-8313-9097eec4f518' AND ingredient_id = '58781af5-4dd9-4a90-b70b-30ac63657dd0'; -- Desem 135g
UPDATE public.recipe_ingredients SET quantity = 0.010 WHERE product_id = '18efb40f-0f8a-42a5-8313-9097eec4f518' AND ingredient_id = '5de97e39-dd7b-4363-bb1b-2e0a88dd4af7'; -- Gerstmeel 10g
UPDATE public.recipe_ingredients SET quantity = 0.010 WHERE product_id = '18efb40f-0f8a-42a5-8313-9097eec4f518' AND ingredient_id = 'b7ce3c26-5a57-4815-94d6-5c8b24fa13ed'; -- Zout 10g
UPDATE public.recipe_ingredients SET quantity = 0.315 WHERE product_id = '18efb40f-0f8a-42a5-8313-9097eec4f518' AND ingredient_id = 'c78aaf1f-c447-43f5-abc2-fef94cf81df5'; -- Water 315g

-- Ciabatta (a17b5555-7a47-43d1-84cd-5ec500feff9a)
UPDATE public.recipe_ingredients SET quantity = 0.070 WHERE product_id = 'a17b5555-7a47-43d1-84cd-5ec500feff9a' AND ingredient_id = 'e706641a-38c5-4cf3-bf8b-f402ee6b7016'; -- Poolish 70g
UPDATE public.recipe_ingredients SET quantity = 0.070 WHERE product_id = 'a17b5555-7a47-43d1-84cd-5ec500feff9a' AND ingredient_id = '58781af5-4dd9-4a90-b70b-30ac63657dd0'; -- Desem 70g
UPDATE public.recipe_ingredients SET quantity = 0.160 WHERE product_id = 'a17b5555-7a47-43d1-84cd-5ec500feff9a' AND ingredient_id = '951b0ded-3578-4309-9644-d4aa7f518cf4'; -- Tarwebloem 160g
UPDATE public.recipe_ingredients SET quantity = 0.007 WHERE product_id = 'a17b5555-7a47-43d1-84cd-5ec500feff9a' AND ingredient_id = '74b1684c-956e-4459-8b3e-c84c7c101068'; -- Roggemeel 7g
UPDATE public.recipe_ingredients SET quantity = 0.007 WHERE product_id = 'a17b5555-7a47-43d1-84cd-5ec500feff9a' AND ingredient_id = '38f48919-4f01-441c-9ec9-6d39d4a997a9'; -- Roggebloem 7g
UPDATE public.recipe_ingredients SET quantity = 0.095 WHERE product_id = 'a17b5555-7a47-43d1-84cd-5ec500feff9a' AND ingredient_id = 'c78aaf1f-c447-43f5-abc2-fef94cf81df5'; -- Water 95g
UPDATE public.recipe_ingredients SET quantity = 0.006 WHERE product_id = 'a17b5555-7a47-43d1-84cd-5ec500feff9a' AND ingredient_id = 'ad34109f-a18d-4c79-a30a-aa98fedbd461'; -- Olijfolie 6g
UPDATE public.recipe_ingredients SET quantity = 0.0045 WHERE product_id = 'a17b5555-7a47-43d1-84cd-5ec500feff9a' AND ingredient_id = 'b7ce3c26-5a57-4815-94d6-5c8b24fa13ed'; -- Zout 4.5g

-- Focaccia (9dcb9a9c-9d1e-4315-aebc-075fedc19df8)
UPDATE public.recipe_ingredients SET quantity = 0.250 WHERE product_id = '9dcb9a9c-9d1e-4315-aebc-075fedc19df8' AND ingredient_id = '66d13562-5f07-4e2d-a4b2-fcce396746ef'; -- Pizzabloem 250g
UPDATE public.recipe_ingredients SET quantity = 0.100 WHERE product_id = '9dcb9a9c-9d1e-4315-aebc-075fedc19df8' AND ingredient_id = '58781af5-4dd9-4a90-b70b-30ac63657dd0'; -- Desem 100g
UPDATE public.recipe_ingredients SET quantity = 0.250 WHERE product_id = '9dcb9a9c-9d1e-4315-aebc-075fedc19df8' AND ingredient_id = '951b0ded-3578-4309-9644-d4aa7f518cf4'; -- Tarwebloem 250g
UPDATE public.recipe_ingredients SET quantity = 0.425 WHERE product_id = '9dcb9a9c-9d1e-4315-aebc-075fedc19df8' AND ingredient_id = 'c78aaf1f-c447-43f5-abc2-fef94cf81df5'; -- Water 425g
UPDATE public.recipe_ingredients SET quantity = 0.013 WHERE product_id = '9dcb9a9c-9d1e-4315-aebc-075fedc19df8' AND ingredient_id = 'b7ce3c26-5a57-4815-94d6-5c8b24fa13ed'; -- Zout 13g
UPDATE public.recipe_ingredients SET quantity = 0.033 WHERE product_id = '9dcb9a9c-9d1e-4315-aebc-075fedc19df8' AND ingredient_id = 'ad34109f-a18d-4c79-a30a-aa98fedbd461'; -- Olijfolie 33g

-- Salted espresso blondie (a8175490-9204-4db9-a3e0-8d28718cea3c)
UPDATE public.recipe_ingredients SET quantity = 0.055 WHERE product_id = 'a8175490-9204-4db9-a3e0-8d28718cea3c' AND ingredient_id = 'f4859756-1d1d-4ad9-b7d5-9d37e9ae4c8b'; -- Boter 55g
UPDATE public.recipe_ingredients SET quantity = 0.055 WHERE product_id = 'a8175490-9204-4db9-a3e0-8d28718cea3c' AND ingredient_id = '7ae3c9b7-3b88-4c49-b059-3f46dba3bab4'; -- Donkerbruine suiker 55g
UPDATE public.recipe_ingredients SET quantity = 0.050 WHERE product_id = 'a8175490-9204-4db9-a3e0-8d28718cea3c' AND ingredient_id = '2dfd8f81-7474-42b6-8258-c1258171c62e'; -- Kristalsuiker 50g
UPDATE public.recipe_ingredients SET quantity = 0.0025 WHERE product_id = 'a8175490-9204-4db9-a3e0-8d28718cea3c' AND ingredient_id = 'a8e706bb-9e42-4a6d-9624-6f60ff3ca5e0'; -- Vanille 2.5g
UPDATE public.recipe_ingredients SET quantity = 0.002 WHERE product_id = 'a8175490-9204-4db9-a3e0-8d28718cea3c' AND ingredient_id = 'b7ce3c26-5a57-4815-94d6-5c8b24fa13ed'; -- Zout 2g
UPDATE public.recipe_ingredients SET quantity = 0.0005 WHERE product_id = 'a8175490-9204-4db9-a3e0-8d28718cea3c' AND ingredient_id = 'c1ddc5b4-bdb3-4076-a071-f04790861920'; -- Baking Soda 0.5g
UPDATE public.recipe_ingredients SET quantity = 0.080 WHERE product_id = 'a8175490-9204-4db9-a3e0-8d28718cea3c' AND ingredient_id = '13ba6467-25f4-4566-b102-8044bce656f4'; -- Franse tarwebloem 80g
UPDATE public.recipe_ingredients SET quantity = 0.070 WHERE product_id = 'a8175490-9204-4db9-a3e0-8d28718cea3c' AND ingredient_id = '0cabd11c-20fe-4016-84ab-651b7b5c46b2'; -- Donkere chocolade 70g

-- Chocolade desembrood (0a47938f-dd20-47fb-9eef-5b0428419394)
UPDATE public.recipe_ingredients SET quantity = 0.055 WHERE product_id = '0a47938f-dd20-47fb-9eef-5b0428419394' AND ingredient_id = '58781af5-4dd9-4a90-b70b-30ac63657dd0'; -- Desem 55g
UPDATE public.recipe_ingredients SET quantity = 0.210 WHERE product_id = '0a47938f-dd20-47fb-9eef-5b0428419394' AND ingredient_id = 'c78aaf1f-c447-43f5-abc2-fef94cf81df5'; -- Water 210g
UPDATE public.recipe_ingredients SET quantity = 0.275 WHERE product_id = '0a47938f-dd20-47fb-9eef-5b0428419394' AND ingredient_id = '951b0ded-3578-4309-9644-d4aa7f518cf4'; -- Tarwebloem 275g
UPDATE public.recipe_ingredients SET quantity = 0.075 WHERE product_id = '0a47938f-dd20-47fb-9eef-5b0428419394' AND ingredient_id = '0cabd11c-20fe-4016-84ab-651b7b5c46b2'; -- Donkere chocolade 75g
UPDATE public.recipe_ingredients SET quantity = 0.022 WHERE product_id = '0a47938f-dd20-47fb-9eef-5b0428419394' AND ingredient_id = '26c1dbf6-8c55-4359-89ad-a6c5a5d249ce'; -- Cacaopoeder 22g
UPDATE public.recipe_ingredients SET quantity = 0.001 WHERE product_id = '0a47938f-dd20-47fb-9eef-5b0428419394' AND ingredient_id = '66fe6db3-f7c9-40c6-b5d5-76e9675fb6a5'; -- Espressopoeder 1g
UPDATE public.recipe_ingredients SET quantity = 0.0045 WHERE product_id = '0a47938f-dd20-47fb-9eef-5b0428419394' AND ingredient_id = 'b7ce3c26-5a57-4815-94d6-5c8b24fa13ed'; -- Zout 4.5g
UPDATE public.recipe_ingredients SET quantity = 0.0045 WHERE product_id = '0a47938f-dd20-47fb-9eef-5b0428419394' AND ingredient_id = 'a8e706bb-9e42-4a6d-9624-6f60ff3ca5e0'; -- Vanille 4.5g
UPDATE public.recipe_ingredients SET quantity = 0.030 WHERE product_id = '0a47938f-dd20-47fb-9eef-5b0428419394' AND ingredient_id = 'a11ce0a5-0e47-461d-966e-5c288c2b0e4c'; -- Maple syrup 30g

-- Blueberry custard bun (9f4bf8e5-adaf-421b-afbf-41f49afbf94c)
UPDATE public.recipe_ingredients SET quantity = 0.001 WHERE product_id = '9f4bf8e5-adaf-421b-afbf-41f49afbf94c' AND ingredient_id = '09265ad6-91b4-4dd5-a2a7-d5f893a35ab1'; -- Gist 1g
UPDATE public.recipe_ingredients SET quantity = 0.017 WHERE product_id = '9f4bf8e5-adaf-421b-afbf-41f49afbf94c' AND ingredient_id = '2dfd8f81-7474-42b6-8258-c1258171c62e'; -- Kristalsuiker 17g
UPDATE public.recipe_ingredients SET quantity = 0.095 WHERE product_id = '9f4bf8e5-adaf-421b-afbf-41f49afbf94c' AND ingredient_id = '951b0ded-3578-4309-9644-d4aa7f518cf4'; -- Tarwebloem 95g
UPDATE public.recipe_ingredients SET quantity = 0.0017 WHERE product_id = '9f4bf8e5-adaf-421b-afbf-41f49afbf94c' AND ingredient_id = 'b7ce3c26-5a57-4815-94d6-5c8b24fa13ed'; -- Zout 1.7g
UPDATE public.recipe_ingredients SET quantity = 0.040 WHERE product_id = '9f4bf8e5-adaf-421b-afbf-41f49afbf94c' AND ingredient_id = '9ebfb286-85f9-4577-af76-dc275b27dd9b'; -- Poedersuiker 40g
UPDATE public.recipe_ingredients SET quantity = 0.025 WHERE product_id = '9f4bf8e5-adaf-421b-afbf-41f49afbf94c' AND ingredient_id = 'ef92ec68-2b23-4047-baed-0ea0708db3cb'; -- Fruitjam 25g
UPDATE public.recipe_ingredients SET quantity = 0.050 WHERE product_id = '9f4bf8e5-adaf-421b-afbf-41f49afbf94c' AND ingredient_id = '4c836af8-35a0-4ea3-a709-545fcc869f99'; -- Blauwe bessen 50g
UPDATE public.recipe_ingredients SET quantity = 0.020 WHERE product_id = '9f4bf8e5-adaf-421b-afbf-41f49afbf94c' AND ingredient_id = '13ba6467-25f4-4566-b102-8044bce656f4'; -- Franse tarwebloem 20g
UPDATE public.recipe_ingredients SET quantity = 0.033 WHERE product_id = '9f4bf8e5-adaf-421b-afbf-41f49afbf94c' AND ingredient_id = 'bb7c5c60-34a2-4890-88ef-59195ab373db'; -- Lichtbruine suiker 33g
UPDATE public.recipe_ingredients SET quantity = 0.001 WHERE product_id = '9f4bf8e5-adaf-421b-afbf-41f49afbf94c' AND ingredient_id = '8c5f0f12-0a26-41b9-b2ec-2f841e843b69'; -- Kaneel 1g
UPDATE public.recipe_ingredients SET quantity = 0.060 WHERE product_id = '9f4bf8e5-adaf-421b-afbf-41f49afbf94c' AND ingredient_id = '9fc0781e-e5f6-403a-aea7-8a014cf795b2'; -- Melk 60g
UPDATE public.recipe_ingredients SET quantity = 0.010 WHERE product_id = '9f4bf8e5-adaf-421b-afbf-41f49afbf94c' AND ingredient_id = 'e9c23f8e-f017-47e8-8ce8-dbc15fa640e3'; -- Slagroom 10g
