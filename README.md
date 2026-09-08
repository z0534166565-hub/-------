# עדכוני בית ועד לחכמים

![Go](https://img.shields.io/badge/Go-1.22-blue?style=flat-square&logo=go)
![Angular](https://img.shields.io/badge/Angular-DD0031?style=flat&logo=angular&logoColor=white)
![Caddy](https://img.shields.io/badge/Caddy-00BFB3?style=flat&logo=caddy&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

**מערכת עדכונים והודעות - בית ועד לחכמים**  
מערכת קלה ופשוטה לניהול ערוץ עדכונים: המנהל מתחבר ומפרסם הודעות, וכלל המשתתפים והעוקבים יכולים לצפות בעדכונים בזמן אמת.

* **צד שרת:** מהיר וחזק, כתוב ב-Go  
* **מסד נתונים:** תואם Redis  
* **צד לקוח:** מבוסס Angular לצפייה נוחה בעדכונים  
* **ניהול דומיין ותעודה:** Caddy  
* **אימות מנהלים:** Google OAuth2  

הפרויקט מופץ תחת רישיון GNU General Public License v3 (GPLv3).  
כל הזכויות שמורות.  

---

## הוראות הרצה  

1. הורדת הפרויקט:  
   `git clone https://github.com/NetFree-Community/TheChannel`  

2. יצירת קובץ `.env` בהתאם לדוגמה בקובץ `sample.env`.  

3. הגדרת הדומיין בקובץ `Caddyfile`:  
   ```caddy
   example.com {
     reverse_proxy backend:3000
   }
