# Contextual Tab Groups [<img align="right" src="https://github.com/user-attachments/assets/013973c7-f0ee-4706-986d-e7e3993fc8d6">](https://chromewebstore.google.com/detail/tab-islands-for-chrome/bnkppmpbnnedcfoncmkbekokhmfkhoin)

### Group tabs by context for you automatically. Inspired by Opera One.

Features:<br>
- ✅ Automatic Tab Groups Creation (Custom Tab Group Names)<br>
  - Default & Search Engine tabs can be set differently!
  - Supports setting Tab Group names to your search query!
- ✅ Auto Disband Groups with only 1 tabs (togglable)<br>
- ✅ Alt+T Shortcut to quickly create a new group (shortcut changable/deletable)

---
## Installation
Get the extension from the [Chrome Web Store](https://chromewebstore.google.com/detail/tab-islands-for-chrome/bnkppmpbnnedcfoncmkbekokhmfkhoin) or [Microsoft Edge Addons](https://microsoftedge.microsoft.com/addons/detail/tab-islands-for-edge/cmbiocblmmeggepnbhnngjnjkmignimb) or [Naver Whale Store](https://store.whale.naver.com/detail/pkmlodmdlnaglamodmnfhjcicbihgaic)

---
## ✅ Fully Supported Browsers
- Google Chrome
- \[Ungoogled] Chromium
- Microsoft Edge
- Brave
- Naver Whale
- Firefox 139/+
  
Most Chromium & Firefox forks (aside from the ones below) should work, but may impose limitations or issues.
## ⚠️ Supported Browsers but need additional setup
- Zen Browser
  - Use this userChrome.css: https://github.com/Vertex-Mods/Advanced-Tab-Groups/blob/main/userChrome.css
  - This userChrome.css is not affiliated with this extension, but it does the job!

## ❌ Unsupported Browsers
- Opera One & Opera GX
  - This is a built-in feature within the browser
  - Extension conflicts with it
- Vivaldi
  - Does not support Tab Groups API
- Kiwi, Quetta, Orion or any mobile browsers that allows Chrome Extensions
  - Does not support Tab Groups API

---

⚠️ Using any third-party newtab extensions or a custom newtab page may break extension functionality

---
## 1. Automatic Tab Groups Creation
| No Tab Group Name     | ![](https://github.com/SpookyKipper/TabIslandsForChrome/blob/main/repo_assets/AutoCreateNoName.gif)      | 
| ------------- | ------------- | 
| Custom Tab Group Name          | ![](https://github.com/SpookyKipper/TabIslandsForChrome/blob/main/repo_assets/AutoCreateWithName.gif)         | 
| Search Engine Group Name | ![image](https://github.com/user-attachments/assets/7bd50289-df37-4117-b0f9-3b6bd47615de)



## 2. Auto Disband Groups with only 1 tabs 
Can be toggled via extension options
| ![](https://github.com/SpookyKipper/TabIslandsForChrome/blob/main/repo_assets/AutoDisband.gif) |
| ------------- |

## 3. Alt+T Shortcut 
No Mouse Click is involved <br>
Changable/deletable via `chrome://extensions/shortcuts`
| Active Tab not in group: <br> Create new group | ![](https://github.com/SpookyKipper/TabIslandsForChrome/blob/main/repo_assets/AltPlusT.gif) |
| ------------- | ------------- |
| Active Tab already in group: <br> Add to existing gruop | ![AltPlusT_InGroup](https://github.com/user-attachments/assets/514657e2-44a1-456c-9875-4f14bd333b8d)




## Extension Options
Settings are available via Extension Popup -> "Go to options" button
### Name for automatically created groups (Default)
This is the name for the Tab Groups being automatically created by the extension. <br>
Available Placeholders: *Experimental*<br>
- `%domain%`
  - `google.com` will return `Google`
  - `web.whatsapp.com` will return `Whatsapp`
  - `www.google.com.hk` will return `Google`
### Name for automatically created groups (Search Engines)
This is the name for the Tab Groups being automatically created by the extension, but the tab you created the new tab on is a search engine.<br>
Available Placeholders:<br>
- `%search_query%` Your search engine search query
  - You searched `cat pics` on Google, the tab group name will be `cat pics`.

Supported Search Engines: Google, Bing, BraveSearch, Ecosia, DuckDuckGo, Ask.com, Yahoo, Startpage, Baidu, YouTube
### Disband Groups with only 1 tab in it
- A toggle to whether automatically ungroup tab groups with only 1 tab in it

## Building
1. run `npm install`<br>
2. run `node buildExtension.js <browser>`
3. Unpacked extension will be available at `dist/<browser>`
4. Pack the extension as ZIP via your File Manager

Supported browsers are `chrome`, `firefox`<br>
Any chromium-based browsers not listed here should also use `chrome` when building.

## Credits
Extension Idea: [Opera One Tab Islands](https://www.opera.com/features/tab-islands)
