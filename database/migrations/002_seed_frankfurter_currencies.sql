-- Seed currencies supported by Frankfurter API.
-- Run this if you already applied 001_init.sql and are hitting FK errors when inserting exchange_rates.

insert into public.currencies (code, name, decimals, is_active) values
  ('AUD', 'Australian Dollar', 2, true),
  ('BRL', 'Brazilian Real', 2, true),
  ('CAD', 'Canadian Dollar', 2, true),
  ('CHF', 'Swiss Franc', 2, true),
  ('CNY', 'Chinese Renminbi Yuan', 2, true),
  ('CZK', 'Czech Koruna', 2, true),
  ('DKK', 'Danish Krone', 2, true),
  ('EUR', 'Euro', 2, true),
  ('GBP', 'British Pound', 2, true),
  ('HKD', 'Hong Kong Dollar', 2, true),
  ('HUF', 'Hungarian Forint', 2, true),
  ('IDR', 'Indonesian Rupiah', 2, true),
  ('ILS', 'Israeli New Sheqel', 2, true),
  ('INR', 'Indian Rupee', 2, true),
  ('ISK', 'Icelandic Króna', 2, true),
  ('JPY', 'Japanese Yen', 0, true),
  ('KRW', 'South Korean Won', 2, true),
  ('MXN', 'Mexican Peso', 2, true),
  ('MYR', 'Malaysian Ringgit', 2, true),
  ('NOK', 'Norwegian Krone', 2, true),
  ('NZD', 'New Zealand Dollar', 2, true),
  ('PHP', 'Philippine Peso', 2, true),
  ('PLN', 'Polish Złoty', 2, true),
  ('RON', 'Romanian Leu', 2, true),
  ('SEK', 'Swedish Krona', 2, true),
  ('SGD', 'Singapore Dollar', 2, true),
  ('THB', 'Thai Baht', 2, true),
  ('TRY', 'Turkish Lira', 2, true),
  ('USD', 'United States Dollar', 2, true),
  ('ZAR', 'South African Rand', 2, true)
on conflict (code) do nothing;





