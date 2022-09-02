const puppeteer = require("puppeteer");
const fs = require('fs');
const electron = require("electron");
const url = require("url");
const path = require("path");

let exPath = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";

const { app, BrowserWindow, Menu, ipcMain } = electron;

let mainWindow;
let configWindow = null;
let taskWindow = null;
let running = false;
let tasks;

app.on("ready", function () {
  mainWindow = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true
    }
  });
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, "mainWindow.html"),
    protocol: "file:",
    slashes: true
  }));
  mainWindow.on("closed", function () {
    app.quit();
  });
  const mainMenu = Menu.buildFromTemplate(mainMenuTemplate);
  mainWindow.setMenu(mainMenu);

});

function createConfigWindow() {
  configWindow = new BrowserWindow({
    width: 230,
    height: 500,
    title: "User config",
    webPreferences: { nodeIntegration: true }
  });
  configWindow.loadURL(url.format({
    pathname: path.join(__dirname, "configWindow.html"),
    protocol: "file:",
    slashes: true
  }));
  configWindow.on("closed", function () {
    configWindow = null;
  });
  configWindow.setMenu(null);
}

function createTaskWindow() {
  taskWindow = new BrowserWindow({
    width: 500,
    height: 500,
    title: "Add a task",
    webPreferences: { nodeIntegration: true }
  });
  taskWindow.loadURL(url.format({
    pathname: path.join(__dirname, "taskWindow.html"),
    protocol: "file:",
    slashes: true
  }));
  taskWindow.on("closed", function () {
    taskWindow = null;
  });
  taskWindow.setMenu(null);
}

ipcMain.on('config-update', (event, rawData) => {
  let data = JSON.stringify(rawData, null, 2);
  fs.writeFileSync('config.json', data, (err) => {
    if (err) throw err;
  });
  configWindow.close();
});

ipcMain.on('add-task', (event, rawData) => {

  tasks = rawData;
  tasks = JSON.stringify(tasks);

  try {
    if (fs.existsSync('tasks.json')) {
      try {
        let data = fs.readFileSync('tasks.json', 'utf8')

        data = data.slice(0, -1);
        data = data + ",\n";

        let tasks_ = tasks + "]"
        data = data + tasks_;

        fs.writeFileSync('tasks.json', data, (err) => {
          if (err) throw err;
        });
      } catch (err) {
        console.error(err)
      }
    } else {
      fs.writeFileSync('tasks.json', "[" + tasks + "]", (err) => {
        if (err) throw err;
      });
    }
  } catch (err) {
    console.error(err);
  }
  mainWindow.webContents.send("task-added", tasks);
  taskWindow.webContents.send('task-added', "");
});


ipcMain.on('get-villages', async (event, rawData) => {
  let data = await getConfig();
  const browser = await puppeteer.launch({ headless: true, executablePath: exPath });
  const page = await browser.newPage();
  await page.setUserAgent(data.userAgent);

  await page.setViewport({
    width: 1920,
    height: 1080,
  });

  await page.goto("https://" + data.server);

  const username_ = await page.$("input[name=name]");
  await username_.focus();
  await page.keyboard.type(data.username);

  const password_ = await page.$("input[name=password]");
  await password_.focus();
  await page.keyboard.type(data.password);

  const submit = await page.$("button[name=s1]");
  await submit.click();

  let villages = [];

  await page.waitFor(3000);
  const root_element = await page.$("div[id=sidebarBoxVillagelist]");
  const village_ul = await root_element.$("ul");
  const village_a = await village_ul.$$("a");
  for (village of village_a) {
    const village_name = await village.$eval("span.name", a => a.innerText);
    villages.push(village_name);
  }

  let villageNames = JSON.stringify(villages, null, 2);
  fs.writeFileSync('villages.json', villageNames, (err) => {
    if (err) throw err;
  });
  taskWindow.webContents.send('village-update', "");
});

const mainMenuTemplate = [
  {
    label: "Config",
    click() {
      if (configWindow == null) {
        createConfigWindow();
      }
    }
  },
  {
    label: "Add tasks",
    click() {
      if (taskWindow == null) {
        createTaskWindow();
      }
    }
  },
  {
    label: "Start",
    click() {
      running = true;
      mainWindow.webContents.send('log', getTime() + " Bot starting...");
      mainWindow.webContents.send('state', "Running");
      start();
    }
  },
  {
    label: "Stop",
    click() {
      running = false;
      mainWindow.webContents.send('state', "Stopped");
      mainWindow.webContents.send('log', getTime() + " Bot stopped");
    }
  },
  {
    label: "Exit",
    click() {
      app.quit();
    }
  },
];

function chromePathUpdate(newPath) {
  exPath = newPath;
}

//Catch pathUpdate
ipcMain.on('pathUpdate', (e, newPath) => {
  chromePathUpdate(newPath);
});

function getTime() {
  var today = new Date();
  var hours;
  var minutes;
  var time;

  if (today.getHours() < 10) {
    hours = "0" + today.getHours();
  }

  else {
    hours = today.getHours();
  }


  if (today.getMinutes() < 10) {
    minutes = "0" + today.getMinutes();
  }

  else {
    minutes = today.getMinutes();
  }

  time = hours + ":" + minutes;

  return time;

}

function randomInteger(min, max) {
  return Math.random() * (parseInt(max, 10) - parseInt(min, 10) + 1) + parseInt(min, 10);
}

async function getConfig() {
  let rawdata = fs.readFileSync('config.json');
  return JSON.parse(rawdata);
}

async function start() {

  var errorCount = 0;

  let data = await getConfig();
  let farmlists = data.farmlists.split(", ");

  function stringToBoolean(string){
    switch(string.toLowerCase().trim()){
        case "true": case "yes": case "1": return true;
        case "false": case "no": case "0": case null: return false;
        default: return Boolean(string);
    }
}

  const browser = await puppeteer.launch({ headless: stringToBoolean(data.headless), executablePath: exPath });
  const page = await browser.newPage();
  await page.setUserAgent(data.userAgent);

  await page.setViewport({
    width: 1920,
    height: 1080,
  });

  await page.goto("https://" + data.server);

  const username_ = await page.$("input[name=name]");
  await username_.focus();
  await page.keyboard.type(data.username);

  const password_ = await page.$("input[name=password]");
  await password_.focus();
  await page.keyboard.type(data.password);

  const submit = await page.$("button[name=s1]");
  await submit.click();


  async function refresh() {

    if (running) {


      try {

        var randomizeTiming = randomInteger(data.intervalMin, data.intervalMax);

        var randomDelay = Math.floor(Math.random() * 2400 + 700);

        let i = 0;
        if (i < farmlists.length && farmlists != undefined && farmlists != "" && running) {

          mainWindow.webContents.send('log', getTime() + " Random delay " + randomDelay + " milliseconds");
          await page.waitFor(randomDelay);
          await page.goto("https://" + data.server + "/dorf2.php");
          mainWindow.webContents.send('log', getTime() + " Succesfully opened building overview");


          randomDelay = Math.floor(Math.random() * 2400 + 700);
          mainWindow.webContents.send('log', getTime() + " Random delay " + randomDelay + " milliseconds");
          await page.waitFor(randomDelay);
          await page.goto("https://" + data.server + "/build.php?id=39");
          mainWindow.webContents.send('log', getTime() + " Succesfully opened rallypoint");


          randomDelay = Math.floor(Math.random() * 2400 + 700);
          mainWindow.webContents.send('log', getTime() + " Random delay " + randomDelay + " milliseconds");
          await page.waitFor(randomDelay);
          await page.goto("https://" + data.server + "/build.php?tt=99&id=39");
          mainWindow.webContents.send('log', getTime() + " Succesfully opened farmlist tab");

          await sendRaids();
        }

        async function sendRaids() {

          let index = i + 1;

          randomDelay = Math.floor(Math.random() * 2400 + 700);
          mainWindow.webContents.send('log', getTime() + " Random delay " + randomDelay + " milliseconds");
          await page.waitFor(3000);
          const checkList2 = await page.$("input[id=raidListMarkAll" + farmlists[i]);
          await checkList2.click();
          mainWindow.webContents.send('log', getTime() + " Succesfully checked " + index + " farmlist");

          randomDelay = Math.floor(Math.random() * 2400 + 700);
          mainWindow.webContents.send('log', getTime() + " Random delay " + randomDelay + " milliseconds");
          await page.waitFor(randomDelay);
          const sendList2 = await page.$("div[id=list" + farmlists[i] + "] button[type=submit]");
          await sendList2.click();
          mainWindow.webContents.send('log', getTime() + " Succesfully sent " + index + " farmlist");

          i++;
          if (i < farmlists.length && running) {
            await sendRaids();
          }
        }

        let rawdata = "";
        let tasks = [];
        
        try {
          if (fs.existsSync('tasks.json')) {
            rawdata = fs.readFileSync('tasks.json');
            tasks = JSON.parse(rawdata);
          }
        } catch (err) {
          console.error(err);
        }

        i = 0;
        if (i < tasks.length && running) {
          await checkTasks();
        }

        async function checkTasks() {
          let index = i + 1;
          mainWindow.webContents.send('log', getTime() + " Checking task " + index);

          if (tasks[i].repeat == "on_repeat"){
          for (task of tasks){
              if (tasks[i].village == task.village){
                 if(task.repeat == "single"){
                  let index = tasks.indexOf(task);
                   if (index > i){
                   i++;
                   mainWindow.webContents.send('log', getTime() + " Skipping task " + index + " to prioritize single mode task");
                   }
                 }
              }
            }
          }

          async function clickToVillage(name) {
            await page.waitFor(3000);
            const root_element = await page.$("div[id=sidebarBoxVillagelist]");
            const village_ul = await root_element.$("ul");
            const village_a = await village_ul.$$("a");
            let village_ = undefined;
            for (village of village_a) {
              const village_name = await village.$eval("span.name", a => a.innerText);
              if (name == village_name) {
                village_ = village;
              }
            }
            return village_;
          }

          mainWindow.webContents.send('log', getTime() + " Navigating to village " + tasks[i].village);
          let clickVillage = await clickToVillage(tasks[i].village);
          await clickVillage.click();

          if (tasks[i].task == "build_res") {
            await page.waitFor(2000);
            const navigation = await page.$("div[id=navigation]");
            let button = await navigation.$("a:nth-child(1)");
            await button.click();

            await page.waitFor(3000);
            const resource_container = await page.$("div[id=resourceFieldContainer]");
            let tiles = await resource_container.$$eval('div[class]', aTags => aTags.map(a => a.getAttribute("class")));

            for (tile of tiles) {
              let tile_data = tile.split(" ");
              let valid = true;

              if (tile_data[0] != "good") {
                valid = false;
              }

              else if (tile_data[5] == "underConstruction") {
                valid = false;
              }

              if (valid == false) {
                let array = [...tiles];
                let index = tiles.indexOf(tile);
                if (index !== -1) {
                  array.splice(index, 1);
                  tiles = array;
                }
              }
            }

            if (tiles.length > 0) {

              for (tile of tiles) {
                let tile_data = tile.split(" ");
                let valid = true;

                if (tasks[i].options == "even") {

                }
                else if (tasks[i].options == "wood") {
                  if (tile_data[3] != "gid1") {
                    valid = false;
                  }
                }
                else if (tasks[i].options == "clay") {
                  if (tile_data[3] != "gid2") {
                    valid = false;
                  }
                }
                else if (tasks[i].options == "iron") {
                  if (tile_data[3] != "gid3") {
                    valid = false;
                  }
                }
                else if (tasks[i].options == "crop") {
                  if (tile_data[3] != "gid4") {
                    valid = false;
                  }
                }
                else if (tasks[i].options == "-crop") {
                  if (tile_data[3] == "gid4") {
                    valid = false;
                  }
                }

                if (valid == false) {
                  let array = [...tiles];
                  let index = tiles.indexOf(tile);
                  if (index !== -1) {
                    array.splice(index, 1);
                    tiles = array;
                  }
                }
              }
              if (tiles.length > 0) {
                let level;
                for (tile of tiles) {
                  let valid = true;
                  let tile_data_lvl = tile.split("  ");
                  let tile_lvl = tile_data_lvl[1].split("l");
                  let index = tiles.indexOf(tile);
                  if (index == 0) {
                    level = tile_lvl[2];
                  }

                  if (tile_lvl[2] > level) {
                    valid = false;
                  }
                  else {
                    level = tile_lvl[2];
                    for (tile of tiles) {
                      let valid = true;
                      let tile_data_lvl = tile.split("  ");
                      let tile_lvl = tile_data_lvl[1].split("l");

                      if (tile_lvl[2] > level) {
                        {
                          let array = [...tiles];
                          let index = tiles.indexOf(tile);
                          if (index !== -1) {
                            array.splice(index, 1);
                            tiles = array;
                          }
                        }
                      }
                    }
                  }

                  if (valid == false) {
                    let array = [...tiles];
                    let index = tiles.indexOf(tile);
                    if (index !== -1) {
                      array.splice(index, 1);
                      tiles = array;
                    }
                  }
                }

                let tiles_data = tiles[0].split(" ");
                let tiles_slot = tiles_data[4].split("t");
                let slot_id = tiles_slot[1];
                console.log(slot_id);
                let field = await resource_container.$("div:nth-child(" + slot_id + ")");
                await field.click();
              }
            }

            await page.waitFor(1000);
            try {
              const section1 = await page.$("div[class=section1]");
              button = await section1.$("button");
              let button_style = await section1.$$eval('button[class]', aTags => aTags.map(a => a.getAttribute("class")));
              console.log(button_style[0]);
              if (button_style[0] == "textButtonV1 green build") {
                await button.click();
                mainWindow.webContents.send('log', getTime() + " Task " + index + " Succesfully executed");
              }
              else {
                mainWindow.webContents.send('log', getTime() + " Cannot execute task " + index + " atm...");
              }

              if (tasks[i].repeat == "single" && button_style[0] == "textButtonV1 green build") {

                const removeItem = (items, i) =>
                  items.slice(0, i - 1).concat(items.slice(i, items.length));

                let taskList = removeItem(tasks, i + 1);

                if (taskList.length == 0) {
                  await fs.unlink("tasks.json");
                }

                else {
                  taskList = taskList.reverse();
                  taskList = JSON.stringify(taskList);

                  await fs.writeFile('tasks.json', taskList, (err) => {
                    if (err) throw err;
                  });
                }
                mainWindow.webContents.send('log', getTime() + " Single mode task removed");
                mainWindow.webContents.send('delete-task', getTime() + "");
              }

            } catch (error) {
              mainWindow.webContents.send('log', getTime() + " Cannot execute task " + index + " atm...");
            }
          }

          else if (tasks[i].task == "build_city" || tasks[i].task == "party") {

            await page.waitFor(2000);
            const navigation = await page.$("div[id=navigation]");
            let button = await navigation.$("a:nth-child(2)");
            await button.click();

            await page.waitFor(3000);
            const village_container = await page.$("div[id=village_map]");
            let tiles = await village_container.$$eval('div[class]', aTags => aTags.map(a => a.getAttribute("class")));


            for (tile of tiles) {
              let tile_data = tile.split(" ");
              let valid = true;


              if (tile_data[0] != "buildingSlot") {
                valid = false;
              }

              if (valid == false) {
                let array = [...tiles];
                let index = tiles.indexOf(tile);
                if (index !== -1) {
                  array.splice(index, 1);
                  tiles = array;
                }
              }
            }

            if (tiles.length > 0) {

              for (tile of tiles) {
                let tile_data = tile.split(" ");
                let valid = true;

                let a = tile_data[1][1];
                if (tile_data[1].length > 2) {
                  a = a + tile_data[1][2];
                }

                if (a < 19) {
                  valid = false;
                }

                if (valid == false) {
                  let array = [...tiles];
                  let index = tiles.indexOf(tile);
                  if (index !== -1) {
                    array.splice(index, 1);
                    tiles = array;
                  }
                }
              }

              if (tiles.length > 0) {
                for (tile of tiles) {
                  let valid = true;
                  let tile_data = tile.split(" ");

                  let g = tile_data[2][1];
                  if (tile_data[2].length > 2) {
                    g = g + tile_data[2][2];
                  }

                  if (tile_data[3] == "bottom" || tile_data[3] == "top") {
                    valid = false;
                  }

                  else if (tasks[i].options == "sawmill") {
                    if (g != 0 && g != 5) {
                      valid = false;
                    }
                  }

                  else if (tasks[i].options == "brickyard") {
                    if (g != 0 && g != 6) {
                      valid = false;
                    }
                  }

                  else if (tasks[i].options == "iron foundry") {
                    if (g != 0 && g != 7) {
                      valid = false;
                    }
                  }

                  else if (tasks[i].options == "grain mill") {
                    if (g != 0 && g != 8) {
                      valid = false;
                    }
                  }

                  else if (tasks[i].options == "bakery") {
                    if (g != 0 && g != 9) {
                      valid = false;
                    }
                  }

                  else if (tasks[i].options == "warehouse") {
                    if (g != 0 && g != 10) {
                      valid = false;
                    }
                  }

                  else if (tasks[i].options == "granary") {
                    if (g != 0 && g != 11) {
                      valid = false;
                    }
                  }

                  else if (tasks[i].options == "main building") {
                    if (g != 0 && g != 15) {
                      valid = false;
                    }
                  }

                  else if (tasks[i].options == "marketplace") {
                    if (g != 0 && g != 17) {
                      valid = false;
                    }
                  }

                  else if (tasks[i].options == "embassy") {
                    if (g != 0 && g != 18) {
                      valid = false;
                    }
                  }

                  else if (tasks[i].options == "town hall") {
                    if (g != 0 && g != 24) {
                      valid = false;
                    }
                  }

                  else if (tasks[i].options == "residence") {
                    if (g != 0 && g != 25) {
                      valid = false;
                    }
                  }

                  else if (tasks[i].options == "palace") {
                    if (g != 0 && g != 26) {
                      valid = false;
                    }
                  }

                  else if (tasks[i].options == "treasury") {
                    if (g != 0 && g != 27) {
                      valid = false;
                    }
                  }

                  else if (tasks[i].options == "trade office") {
                    if (g != 0 && g != 28) {
                      valid = false;
                    }
                  }

                  else if (tasks[i].options == "granny") {
                    if (g != 0 && g != 23) {
                      valid = false;
                    }
                  }

                  else if (tasks[i].options == "smithy") {
                    if (g != 0 && g != 13) {
                      valid = false;
                    }
                  }

                  else if (tasks[i].options == "tournament square") {
                    if (g != 0 && g != 14) {
                      valid = false;
                    }
                  }

                  else if (tasks[i].options == "rally point") {
                    if (g != 0 && g != 16) {
                      valid = false;
                    }
                  }

                  else if (tasks[i].options == "barracks") {
                    if (g != 0 && g != 19) {
                      valid = false;
                    }
                  }

                  else if (tasks[i].options == "stable") {
                    if (g != 0 && g != 20) {
                      valid = false;
                    }
                  }

                  else if (tasks[i].options == "workshop") {
                    if (g != 0 && g != 21) {
                      valid = false;
                    }
                  }

                  else if (tasks[i].options == "academy") {
                    if (g != 0 && g != 22) {
                      valid = false;
                    }
                  }

                  else if (tasks[i].options == "heros mansion") {
                    if (g != 0 && g != 37) {
                      valid = false;
                    }
                  }

                  else {
                    valid = false;
                  }

                  if (valid == false) {

                    let array = [...tiles];
                    let index = tiles.indexOf(tile);
                    if (index !== -1) {
                      array.splice(index, 1);
                      tiles = array;
                    }
                  }
                }

                if (tiles.length == 0) {

                  const removeItem = (items, i) =>
                    items.slice(0, i - 1).concat(items.slice(i, items.length))

                  let taskList = removeItem(tasks, i + 1);

                  if (taskList.length == 0) {
                   await fs.unlink("tasks.json");
                  }

                  else {
                    taskList = taskList.reverse();
                    taskList = JSON.stringify(taskList);

                    await fs.writeFile('tasks.json', taskList, (err) => {
                      if (err) throw err;
                    });
                  }
                  mainWindow.webContents.send('log', getTime() + " Impossible task detected");
                  mainWindow.webContents.send('log', getTime() + " Task deleted");
                  mainWindow.webContents.send('delete-task', getTime() + "");
                }

                else {
                  let building_exists = false;
                  for (tile of tiles) {
                    let tile_data = tile.split(" ");

                    let g = tile_data[2][1];
                    if (tile_data[2].length > 2) {
                      g = g + tile_data[2][2];
                    }
                    if (g != 0) {
                      building_exists = true;
                    }
                  }

                  let slot_id;

                  if (building_exists == true) {
                    for (tile of tiles) {
                      let tile_data = tile.split(" ");

                      let a = tile_data[1][1];
                      if (tile_data[1].length > 2) {
                        a = a + tile_data[1][2];
                      }
                      let g = tile_data[2][1];
                      if (tile_data[2].length > 2) {
                        g = g + tile_data[2][2];
                      }
                      if (g != 0) {
                        slot_id = a;
                      }
                    }

                    let field_div = await village_container.$("div:nth-child(" + slot_id + ")");
                    let field = await field_div.$("g[class=clickShape]");
                    await field.click();

                    if (tasks[i].task == "build_city") {

                      await page.waitFor(3000);
                      try {
                        const section1 = await page.$("div[class=section1]");

                        button = await section1.$("button");
                        let button_style = await section1.$$eval('button[class]', aTags => aTags.map(a => a.getAttribute("class")));
                        console.log(button_style[0]);
                        if (button_style[0] == "textButtonV1 green build") {
                          await button.click();
                          mainWindow.webContents.send('log', getTime() + " Task " + index + " Succesfully executed");
                        }
                        else {
                          mainWindow.webContents.send('log', getTime() + " Cannot execute task " + index + " atm...");
                        }

                        if (tasks[i].repeat == "single" && button_style[0] == "textButtonV1 green build") {

                          const removeItem = (items, i) =>
                            items.slice(0, i - 1).concat(items.slice(i, items.length));
          
                          let taskList = removeItem(tasks, i + 1);
          
                          if (taskList.length == 0) {
                            await fs.unlink("tasks.json");
                          }
          
                          else {
                            taskList = taskList.reverse();
                            taskList = JSON.stringify(taskList);
          
                            await fs.writeFile('tasks.json', taskList, (err) => {
                              if (err) throw err;
                            });
                          }
                          mainWindow.webContents.send('log', getTime() + " Single mode task removed");
                          mainWindow.webContents.send('delete-task', getTime() + "");
                        }

                      } catch (error) {
                        mainWindow.webContents.send('log', getTime() + " Cannot execute task " + index + " atm...");
                      }
                    }

                    else if (tasks[i].task == "party") {

                      await page.waitFor(3000);
                      try {
                        const div = await page.$("div[class=cta]");

                        button = await div.$("button");
                        let button_style = await div.$$eval('button[class]', aTags => aTags.map(a => a.getAttribute("class")));
                        console.log(button_style[0]);
                        if (button_style[0] == "textButtonV1 green ") {
                          await button.click();
                          mainWindow.webContents.send('log', getTime() + " Task " + index + " Succesfully executed");
                        }
                        else {
                          mainWindow.webContents.send('log', getTime() + " Cannot execute task " + index + " atm...");
                        }

                        if (tasks[i].repeat == "single" && button_style[0] == "textButtonV1 green ") {

                          const removeItem = (items, i) =>
                            items.slice(0, i - 1).concat(items.slice(i, items.length));
          
                          let taskList = removeItem(tasks, i + 1);
          
                          if (taskList.length == 0) {
                            await fs.unlink("tasks.json");
                          }
          
                          else {
                            taskList = taskList.reverse();
                            taskList = JSON.stringify(taskList);
          
                            await fs.writeFile('tasks.json', taskList, (err) => {
                              if (err) throw err;
                            });
                          }
                          mainWindow.webContents.send('log', getTime() + " Single mode task removed");
                          mainWindow.webContents.send('delete-task', getTime() + "");
                        }

                      } catch (error) {
                        mainWindow.webContents.send('log', getTime() + " Cannot execute task " + index + " atm...");
                      }
                    }

                  }

                  else if (building_exists == false) {
                    for (tile of tiles) {
                      let tile_data = tile.split(" ");

                      let a = tile_data[1][1];
                      if (tile_data[1].length > 2) {
                        a = a + tile_data[1][2];
                      }
                      slot_id = a;
                    }

                    if (tasks[i].task == "party") {

                      const removeItem = (items, i) =>
                        items.slice(0, i - 1).concat(items.slice(i, items.length))

                      let taskList = removeItem(tasks, i + 1);

                      if (taskList.length == 0) {
                        await fs.unlink("tasks.json");
                      }

                      else {
                        taskList = taskList.reverse();
                        taskList = JSON.stringify(taskList);

                        await fs.writeFile('tasks.json', taskList, (err) => {
                          if (err) throw err;
                        });
                      }
                      mainWindow.webContents.send('log', getTime() + " Impossible task detected");
                      mainWindow.webContents.send('log', getTime() + " Task deleted");
                      mainWindow.webContents.send('delete-task', getTime() + "");
                    }

                    else {

                      let field_div = await village_container.$("div:nth-child(" + slot_id + ")");
                      let field = await field_div.$("g[class=clickShape]");
                      await field.click();

                      const removeItem = (items, i) =>
                        items.slice(0, i - 1).concat(items.slice(i, items.length))

                      let taskList = removeItem(tasks, i + 1);

                      if (taskList.length == 0) {
                       await fs.unlink("tasks.json");
                      }

                      else {
                        taskList = taskList.reverse();
                        taskList = JSON.stringify(taskList);

                        await fs.writeFile('tasks.json', taskList, (err) => {
                          if (err) throw err;
                        });
                      }
                      mainWindow.webContents.send('log', getTime() + " New building task not supported yet...");
                      mainWindow.webContents.send('log', getTime() + " Upgrade already existing buildings instead");
                      mainWindow.webContents.send('log', getTime() + " Task deleted");
                      mainWindow.webContents.send('delete-task', getTime() + "");
                    }
                  }
                }
              }
            }
          }

          i++;
          if (i < tasks.length) {
            await checkTasks();
          }
        }

        errorCount = 0;
        if (running) {
          mainWindow.webContents.send('log', getTime() + " Next refresh in " + randomizeTiming + " minutes");
          setTimeout(refresh, randomizeTiming * 60000);
        }

      } catch (e) {

        mainWindow.webContents.send('log', getTime() + " " + e);
        errorCount++;

      } finally {

        if (errorCount != 0 && errorCount < 3) {
          mainWindow.webContents.send('log', getTime() + " Error, trying again...");
          await refresh();
        }
        else if (errorCount == 3) {
          mainWindow.webContents.send('log', getTime() + " Too many errors, bot stopped");
          mainWindow.webContents.send('state', "Stopped");
          running = false;
        }
      }
    }
  }

  await refresh();

}