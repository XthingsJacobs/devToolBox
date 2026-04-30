export type Locale = 'en';

export interface LocaleMessages {
  [key: string]: string | LocaleMessages;
}
