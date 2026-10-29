LUMINA INTELIGENTA — prima versiune

CONTINUT
index.html, style.css, app.js, icon.svg, manifest.webmanifest, sw.js.
Nu necesita npm sau compilare. Firebase este importat ca module din CDN.
Nu include conturi, parole, service-account sau acces administrativ.

PUBLICARE GITHUB PAGES
1. Creeaza un repository (fara parole / config.h ESP in el).
2. Incarca fisierele web la radacina repository-ului, nu arhiva ZIP.
3. Settings > Pages > Deploy from a branch > main > /(root) > Save.
4. Deschide adresa afisata de GitHub Pages, apoi Setari.
5. Introdu numele clientului, ROOT_NODE si firebaseConfig din consola Firebase.
6. Salveaza, apoi autentifica-te cu un cont Email/Password existent.
Aplicatia nu trebuie deschisa prin dublu-click file://. Foloseste HTTPS / GitHub Pages.
Pentru test local poti folosi un server static local (ex: python -m http.server).

FIREBASE
Authentication > Sign-in method: activeaza Email/Password.
Creeaza contul clientului si contul ESP in Authentication > Users.
Nu publica parolele si nu pune cheia privata de service account in pagina.
Configuratia firebaseConfig se pastreaza in localStorage al browserului.
Sesiunea de autentificare este de tip session (nu parola in localStorage).
Foloseste dispozitive si browsere de incredere. Biblioteca gestioneaza tokenurile.
Proiect nou = configuratie noua si conturi noi, ESP-urile configurate pentru acel proiect.
Poti adauga domeniul GitHub Pages in Authentication > Settings > Authorized domains
pentru fluxurile Firebase care necesita autorizarea domeniului; aceasta nu inlocuieste regulile RTDB.

REGULI
database.rules.example.json este un EXEMPLU, nu se publica automat.
Inlocuieste UID_UTILIZATOR_APP si UID_DISPOZITIV cu UID din Authentication > Users.
Inlocuieste "luci" cu ROOT_NODE real, apoi publica regulile in RTDB > Rules.
Cu UID placeholder lasat nemodificat, accesul va fi refuzat.
Acest exemplu da celor doua conturi acces complet la instalatia clientului.
Pentru mai multe identitati ESP, extinde explicit lista de UID permise.
Nu folosi .read/.write true public. Regulile existente la nivel parinte pot acorda
acces mai larg; verifica intreaga configuratie, nu doar o regula copil.

CAMERE
Setari > Configurare Camere > +. Numele afisat poate contine diacritice.
ID-ul foloseste litere mici/cifre/_/- si trebuie sa coincida cu ROOM_ID din ESP.
Camera existenta nu este suprascrisa la adaugare (tranzactie).
Redenumire modifica doar "nume". Nu exista stergere in aceasta prima versiune.
Camerele existente cu releu/led_on/led_brightness sunt detectate automat.
Acasa afiseaza sageti numai daca exista minimum doua camere.
Luminozitatea foloseste niveluri 1..5, nu procente liniare 20..100.

ONLINE / OFFLINE
Firebase: conexiunea browserului la RTDB, nu conexiunea ESP.
Dispozitiv: last_seen, timp Unix in MILISECUNDE scris de ESP folosind timestamp server.
Online pana la 90 secunde, offline dupa; fara valoare = Necunoscut.
Browserul nu scrie last_seen si adaugarea camerei nu o face artificial online.
Firmware vechi fara last_seen: activeaza explicit in Setari optiunea
"Permite comenzi camerelor fara last_seen". Aceasta NU falsifica indicatorul.
Dispozitivele cu last_seen expirat raman blocate si in acest mod.
Integrarea heartbeat in firmware este descrisa in firmware-heartbeat.txt.

COMENZI
Pagina asculta datele Firebase, dar ESP citeste periodic (aproximativ 2 secunde + retea).
Scriere reusita in Firebase nu confirma fizic becul/releul.
Comenzile sunt dezactivate cand conexiunea Firebase este absenta.
Daca legatura cade chiar in timpul unei scrieri, SDK poate pastra acea scriere
pana la reconectare; nu presupune anularea automata a unei cereri deja lansate.
Aplicatia nu poate confirma pozitia contactelor fara feedback hardware.

PWA
Manifest si service worker pentru interfata incluse. API-urile Firebase nu sunt
stocate de service worker. SDK-ul este incarcat din CDN, deci prima incarcare
si operarea necesita internet. Nu este o aplicatie de control offline.
Instalarea "Adauga pe ecranul de pornire" depinde de browser/platforma;
pictograma SVG poate necesita variante PNG pentru unele platforme.
La modificarea fisierelor shell, creste versiunea CACHE din sw.js.

VERIFICARE MANUALA NECESARA
Pachetul a fost generat, dar nu a fost rulat cu proiectul tau real sau testat
intr-un browser pe telefon. Verifica autentificare, reguli, creare camera,
renumire, sageti, buton fizic, comenzi web, deconectare si revenire.
