// src/app/core/cookie-utils.ts
export function clearAllCookies(): void {
  try {
    const cookies = document.cookie ? document.cookie.split(';') : [];
    const hostname = location.hostname;
    const domainParts = hostname.split('.');
    const expire = 'expires=Thu, 01 Jan 1970 00:00:00 GMT';
    const paths = ['/', location.pathname || '/'];

    const domainVariants: string[] = [];
    for (let i = 0; i < domainParts.length; i++) {
      domainVariants.push(domainParts.slice(i).join('.'));
    }

    for (const raw of cookies) {
      const [name] = raw.split('=');
      const cookieName = name.trim();
      for (const path of paths) {
        document.cookie = `${cookieName}=;${expire};path=${path};`;
        for (const d of domainVariants) {
          document.cookie = `${cookieName}=;${expire};path=${path};domain=.${d};`;
          document.cookie = `${cookieName}=;${expire};path=${path};domain=${d};`;
        }
      }
    }
  } catch {
    /* ignore */
  }
}
