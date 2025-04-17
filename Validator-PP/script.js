var codeEditorTxt = "";
var ajv_validate;
var lineCountCache = 0;
var version = "0";
var autocomplete = "enabled";
var savedSchema = "";
var json = {};
var observer;
const openMenuBtn = document.getElementById('openMenuBtn');
const openExercisesMenuBtn = document.getElementById('openExercisesMenuBtn');
const contextMenuExamples = document.getElementById('contextMenuExamples');
const contextMenuExercises = document.getElementById('contextMenuExercises');

var i = 0;

var files = [];

var container = document.getElementById('jsoneditor');

const schemaURL = "https://raw.githubusercontent.com/IDMEFv2/IDMEFv2-Drafts/refs/heads/main/IDMEFv2/latest/IDMEFv2.schema";
let validationEnabled = true;
let editor;

require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.38.0/min/vs' } });
require(["vs/editor/editor.main"], function () {
  async function loadSchema(url) {
    try {
      const response = await fetch(url);
      return await response.json();
    } catch (error) {
      console.error("Error while loading the JSON Schema:", error);
      return null;
    }
  }

  async function initEditor() {
    const schema = await loadSchema(schemaURL);
    
    fetchVersionFolderPairs();
    updateValidation(validationEnabled, schema);

    editor = monaco.editor.create(document.getElementById("jsoneditor"), {
      value: "{}",
      language: "json",
      theme: "vs-light"
    });
  }

  function updateValidation(enable, schema = null) {
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: enable,
      schemas: enable && schema ? [{
        uri: schemaURL,
        fileMatch: ["*"],
        schema: schema
      }] : []
    });
  }
  initEditor();
});

// Some fake exercises used to test the menu function
var jsonArray = [
  {
    "name": "intrusion-detection-1.json",
    "json": {
      "Version": "2.0.3",
      "ID": "e5f9bbae-163e-42f9-a2f2-0daaf78fefb2",
      "CreateTime": "2021-01-18T23:34:05.21Z",
      "StartTime": "2021-01-18T23:34:04.52Z",
      "Cause": "Malicious",
      "Category": [
        "Intrusion.Burglary"
      ],
      "Severity": "medium",
      "Confidence": 0.9,
      "Description": "Physical intrusion detected",
      "Analyzer": {
        "IP": "1.1.1.1",
        "Name": "Motion detector"
      },
      "Sensor": [
        {
          "IP": "1.1.1.2",
          "Name": "Infrared camera 42"
        }
      ],
      "Vector": [
        {
          "Category": [
            "human"
          ],
          "AttachHandle": [
            "attach1"
          ],
          "ObservableHandle": [
            "obs1"
          ]
        }
      ],
      "Attachment": [
        {
          "Handle": "attach1",
          "FileName": "img2021011823340521.jpg",
          "ExternalURI": "https://data.acme.eu/img2021011823340521.jpg",
          "ContentType": "image/jpeg"
        }
      ],
      "Observable": [
        {
          "Handle": "obs1",
          "Content": "{\"Xmin\": 22, \"Xmax\": 100, \"Ymin\": 501, \"Ymax\": 692}"
        }
      ]
    }
  },
  {
    "name": "network-anomaly-1.json",
    "json": {
      "Version": "2.0.3",
      "ID": "a1b2c3d4-e567-89f0-1234-56789abcdef0",
      "CreateTime": "2021-02-10T14:22:10.00Z",
      "StartTime": "2021-02-10T14:20:45.78Z",
      "Cause": "Anomalous",
      "Category": [
        "Network.Anomaly"
      ],
      "Severity": "high",
      "Confidence": 0.95,
      "Description": "Unusual network traffic detected",
      "Analyzer": {
        "IP": "8.8.8.8",
        "Name": "Traffic Monitor"
      },
      "Sensor": [
        {
          "IP": "192.168.1.10",
          "Name": "Router Sensor"
        }
      ],
      "Vector": [
        {
          "Category": [
            "network"
          ],
          "AttachHandle": [
            "attach2"
          ],
          "ObservableHandle": [
            "obs2"
          ]
        }
      ],
      "Attachment": [
        {
          "Handle": "attach2",
          "FileName": "network_dump_20210210.pcap",
          "ExternalURI": "https://data.acme.eu/network_dump_20210210.pcap",
          "ContentType": "application/vnd.tcpdump.pcap"
        }
      ],
      "Observable": [
        {
          "Handle": "obs2",
          "Content": "{\"SrcIP\": \"192.168.1.5\", \"DstIP\": \"10.0.0.1\", \"Protocol\": \"TCP\", \"Port\": 443}"
        }
      ]
    }
  }
];

const toggleButton = document.getElementById('dark-mode-toggle');
const saveModal = document.getElementById('save-modal')
const icon = toggleButton.querySelector('i');

toggleButton.addEventListener('click', () => {
  if (icon.classList.contains('fa-sun')) {
    icon.classList.remove('fa-sun');
    icon.classList.add('fa-moon');
  } else {
    icon.classList.remove('fa-moon');
    icon.classList.add('fa-sun');
  }
  document.body.classList.toggle('dark-mode');
  saveModal.classList.toggle('dark-mode');
});

$(document).ready(async function () {
  await initFilesList("latest");
  await initSchema("latest")

  // Using the button to call the upload function
  document.getElementById('upload').addEventListener('click', function () {
    const fileInput = document.getElementById('idmefv2_file');
    fileInput.value = '';
    fileInput.click();
  });

  // Handling the Upload and adding the json's content to the editor
  document.getElementById('idmefv2_file').addEventListener('change', function (event) {
    var file = event.target.files[0];

    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        var result = event.target.result;
        try {
          var json = JSON.parse(result);
          editor.setValue(JSON.stringify(json, null, 2));
          $('#selectedFileName').val(file.name);
        } catch (error) {
          console.error("Error parsing JSON:", error);
        }
      };

      reader.readAsText(file);
    }
  });
});

// Functions related to the copy popup

function showPopUp(id, timeout) {

  popUp = document.getElementById(id);

  popUp.classList.add('popup-visible');
  popUp.classList.remove('popup-hidden');
  setTimeout(() => {
    hidePopUp(id);
  }, timeout);
}

function hidePopUp(id) {
  popUp = document.getElementById(id);

  popUp.classList.remove('popup-visible');
  popUp.classList.add('popup-hidden');
}

// ---------------------------

// Functions for the custom buttons

// Prints the only available exercise
// It will be updated to the definitive version once more are available
function printExercise(exercise) {
  // disableValidation();
  cleanResult()
  json = jsonArray.find(json => json.name == exercise);
  $('#selectedFileName').val(json.name);
  editor.setValue(JSON.stringify(json.json, null, 2));
}

// Cycles between the examples found inside the repository
function printExample(example) {
  enableValidation();
  cleanResult();

  if (files.length > 0) {

    var url = `https://raw.githubusercontent.com/IDMEFv2/IDMEFv2-Examples/refs/heads/main/latest/` + example;

    $.getJSON(url, function (exampleJson) {
      json = exampleJson;
      $('#selectedFileName').val(example);
      editor.setValue(JSON.stringify(json, null, 2));
    });

  } else {
    console.error("No files have been found inside the repository");
  }
}

// Save the file in the chosen format and close the modal
function saveFileAs() {
  var currentJson = editor.getValue();
  let format = document.getElementById("format").value;
  let fileName = document.getElementById("fileName").value;
  if (fileName === "") {
    const timestamp = new Date().toISOString().replace(/[-:.]/g, "");
    fileName = `IDMEFv2_${timestamp}`;
  }
  var defaultFilename = format === ".json" ? `${fileName}.json` : `${fileName}.txt`;
  var textBlob = new Blob([currentJson], { type: 'application/json' });

  var downloadLink = document.createElement("a");
  downloadLink.download = defaultFilename;
  downloadLink.href = window.URL.createObjectURL(textBlob);
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(downloadLink.href);

  document.getElementById('save-modal').style.display = "none";
  document.getElementById('overlay').style.display = "none";
  document.getElementById('fileName').value = "";
}

// Copy the current json to clipboard and show the popup
function copy_text() {
  var currentJson = editor.getValue();

  var tempInput = document.createElement("textarea");
  tempInput.style.position = "absolute";
  tempInput.style.opacity = "0";
  document.body.appendChild(tempInput);

  tempInput.value = currentJson;

  tempInput.select();
  tempInput.setSelectionRange(0, 99999);

  document.execCommand("copy");

  document.body.removeChild(tempInput);
  showPopUp("success-popup", 3000);
}

function clear_text() {
  enableValidation();
  cleanResult()
  json = {};
  $('#selectedFileName').val('');
  editor.setValue('{}');
}

function validate() {
  enableValidation();
  let result = document.getElementById("idmefv2_text_result");
  result.innerHTML = "";

  json = editor.getValue()

  if (!json) {
    result.innerHTML = "<p class=\"noerrors\">No data provided to validate.</p>";
    return;
  } else {
    var valid = ajv_validate(JSON.parse(json));
    if (!valid) {
      ajv_validate.errors.forEach(function (err) {
        let path = err.dataPath ? err.dataPath.substr(1) : "Root";
        if (err.keyword === "additionalProperties") {
          path += "." + err.params.additionalProperty;
        }
        result.innerHTML += `Path: <a href="#" class="modal-link" onclick="showSchema('${path}')">${path}</a>, Error: ${err.message} <br/>`;
      });
    } else {
      result.innerHTML = "<p class=\"noerrors\">No errors</p>";
    }
  }
}

// -----------------

function cleanResult() {
  let result = document.getElementById("idmefv2_text_result");

  result.innerHTML = "";
}

// Look for a definition in the schema
function findSchemaInfo(path) {

  if (path.startsWith('Root.')) {
    path = path.slice(5);
  }

  path = path.replace(/\[\d+\]/g, '');

  let schemaPart = savedSchema.properties || {};

  if (!path) {
    return JSON.stringify(schemaPart, null, 2);
  }

  let keys = path.split('.');

  $('#schemaTitle').text('Schema Information for: ' + path);

  for (let key of keys) {
    if (schemaPart[key] !== undefined) {
      schemaPart = schemaPart[key];
    } else if (schemaPart.items && schemaPart.items.properties && schemaPart.items.properties[key] !== undefined) {
      schemaPart = schemaPart.items.properties[key];
    } else {
      return 'No schema information found for this path. Please check that the property exists and is spelled correctly.';
    }
  }

  return JSON.stringify(schemaPart, null, 2);
}

// Open Schema details
function showSchema(path) {
  const schemaInfo = findSchemaInfo(path);
  document.getElementById('schemaDefinition').innerText = schemaInfo;
  document.getElementById('schemaModal').style.display = "block";
  document.getElementById('overlay').style.display = "block";
}

// Open Save modal
function openSave() {
  document.getElementById('save-modal').style.display = "block";
  document.getElementById('overlay').style.display = "block";
}

// Close all modals and remove the overlay
function closeModal() {
  document.getElementById('schemaModal').style.display = "none";
  document.getElementById('overlay').style.display = "none";
  document.getElementById('save-modal').style.display = "none";
  document.getElementById('fileName').value = "";
}

// Function to recover the file names form github
async function initFilesList(version = "latest") {
  const baseUrl = "https://api.github.com/repos/IDMEFv2/IDMEFv2-Examples/contents/";
  
  // Normalizing the version name to adapt it to the ones used in the other repository
  let normalizedVersion = version === "latest" ? "latest" : `V${parseInt(version, 10)}`;
  let apiUrl = `${baseUrl}${normalizedVersion}`;
  let data;

  try {
    data = await $.getJSON(apiUrl);
  } catch (error) {
    $("#warning-text").text(`No examples available for ${normalizedVersion}, displaying 'latest'.`);
    showPopUp("warning-popup", 3000);
    try {
      data = await $.getJSON(`${baseUrl}latest`);
    } catch (fallbackError) {
      console.error("Errore anche nel recuperare gli esempi da 'latest'.", fallbackError);
      return;
    }
  }

  files = data.map(file => file.name);
  const filesMenu = document.getElementById("contextMenuExamplesUl");
  filesMenu.innerHTML = "";

  data.forEach(file => {
    const listItem = document.createElement("li");
    listItem.classList.add("context-option");
    listItem.setAttribute("data-value", file.name);
    listItem.textContent = file.name;
    filesMenu.appendChild(listItem);
  });

  ExercisesMenu = document.getElementById("contextMenuExercisesUl");
  ExercisesMenu.innerHTML = "";

  jsonArray.forEach(file => {
    const listItem = document.createElement("li");
    listItem.classList.add("context-option");
    listItem.setAttribute("data-value", file.name);
    listItem.textContent = file.name;
    ExercisesMenu.appendChild(listItem);
  });
}

// Preparing the schema for validation
async function initSchema(folder) {
  const schemaURL = `https://raw.githubusercontent.com/IDMEFv2/IDMEFv2-Drafts/refs/heads/main/IDMEFv2/${folder}/IDMEFv2.schema`;

  await $.getJSON(`https://raw.githubusercontent.com/json-schema-org/json-schema-spec/draft-04/schema.json`, async function (metaschema) {
    await $.getJSON(schemaURL, function (schema) {
      savedSchema = schema;
      const description = schema.description;

      const regex = /revision\s([\w\.]+)\)/;
      const match = description.match(regex);

      if (match) {
        const version = match[1];
        $('#autocomplete').text('enabled');
        $('#version-output').text('Version ' + version);
        $('#title').text('IDMEFv2 - JSON Validator - Version ' + version);
      } else {
        console.log('No revision has been found');
      }

      var ajv = new Ajv({ schemaId: 'id', allErrors: true });
      ajv.addMetaSchema(metaschema);
      ajv_validate = ajv.compile(schema);

      monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: validationEnabled,
        schemas: [
          {
            uri: schemaURL,
            fileMatch: ["*"],
            schema: savedSchema
          }
        ]
      });
    });
  });
}


openMenuBtn.addEventListener('click', (event) => {
  event.stopPropagation();

  contextMenuExercises.classList.add("menu-hidden");

  const rect = openMenuBtn.getBoundingClientRect();
  contextMenuExamples.style.top = `${rect.bottom + window.scrollY}px`;
  contextMenuExamples.style.left = `${rect.left}px`;

  contextMenuExamples.classList.toggle("menu-hidden");
});

document.getElementById("contextMenuExamplesUl").addEventListener("click", (e) => {
  if (e.target.classList.contains("context-option")) {
    const selectedValue = e.target.getAttribute("data-value");
    printExample(selectedValue);

    document.getElementById("contextMenuExamples").classList.add("menu-hidden");
  }
});

document.addEventListener('click', (e) => {
  if (!contextMenuExamples.contains(e.target) && e.target !== openMenuBtn) {
    contextMenuExamples.classList.add("menu-hidden");
  }
});

// --------------

openExercisesMenuBtn.addEventListener('click', (event) => {
  event.stopPropagation();

  contextMenuExamples.classList.add("menu-hidden");

  const rect = openExercisesMenuBtn.getBoundingClientRect();
  contextMenuExercises.style.top = `${rect.bottom + window.scrollY}px`;
  contextMenuExercises.style.left = `${rect.left}px`;

  contextMenuExercises.classList.toggle("menu-hidden");
});

document.getElementById("contextMenuExercisesUl").addEventListener("click", (e) => {
  if (e.target.classList.contains("context-option")) {
    const selectedValue = e.target.getAttribute("data-value");
    printExercise(selectedValue)

    document.getElementById("contextMenuExercises").classList.add("menu-hidden");
  }
});

document.addEventListener('click', (e) => {
  if (!contextMenuExercises.contains(e.target) && e.target !== openExercisesMenuBtn) {
    contextMenuExercises.classList.add("menu-hidden");
  }
});

function enableValidation() {
  validationEnabled = true;
  $('#autocomplete').text('enabled');
  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: validationEnabled,
    schemas: [
      {
        uri: "https://raw.githubusercontent.com/IDMEFv2/IDMEFv2-Drafts/refs/heads/main/IDMEFv2/latest/IDMEFv2.schema",
        fileMatch: ["*"],
        schema: savedSchema
      },
    ],
  });
}

function disableValidation() {
  validationEnabled = false;
  $('#autocomplete').text('disabled');
  monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
    validate: validationEnabled,
    schemas: validationEnabled
      ? [
        {
          uri: "https://raw.githubusercontent.com/IDMEFv2/IDMEFv2-Drafts/refs/heads/main/IDMEFv2/latest/IDMEFv2.schema",
          fileMatch: ["*"],
        },
      ]
      : [],
  });
}

// New function to toggle validation state
function toggleAutocomplete() {
  const autocompleteButton = $('#autocomplete'); // Get the button element
  const isEnabled = autocompleteButton.text() === 'enabled'; // Check current text

  if (isEnabled) {
    disableValidation(); // If enabled, disable it
  } else {
    enableValidation(); // If disabled, enable it
  }
}

async function fetchVersionFolderPairs() {
  const repo = "IDMEFv2/IDMEFv2-Drafts";
  const path = "IDMEFv2";
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${path}`;
  const rawBase = `https://raw.githubusercontent.com/${repo}/main/${path}`;

  const versionMap = new Map();

  const folders = await fetch(apiUrl)
    .then(res => res.json())
    .then(data => data.filter(item => item.type === "dir").map(item => item.name));

  // Ordina prima "latest", poi le versioni numeriche
  folders.sort((a, b) => {
    if (a === "latest") return -1;
    if (b === "latest") return 1;
    return a.localeCompare(b);
  });

  // Filtriamo le cartelle per includere solo quelle dalla versione 04 in poi
  const validFolders = folders.filter(folder => {
    // Salta "latest" e cartelle precedenti a "04"
    return folder === "latest" || parseInt(folder, 10) >= 4;
  });

  for (const folder of validFolders) {
    const schemaUrl = `${rawBase}/${folder}/IDMEFv2.schema`;

    try {
      const res = await fetch(schemaUrl);
      const schemaText = await res.text();
      const schema = JSON.parse(schemaText);

      const versionEnum = schema?.properties?.Version?.enum;
      if (Array.isArray(versionEnum)) {
        for (const version of versionEnum) {
          if (!versionMap.has(version)) {
            versionMap.set(version, folder);
          }
        }
      }
    } catch (err) {
      console.warn(`${folder}: ${err.message}`);
    }
  }

  // Ordina i risultati
  const result = Array.from(versionMap.entries())
    .map(([version, folder]) => ({ version, folder }))
    .sort((a, b) => (a.version > b.version ? 1 : -1));

  result.sort((a, b) => {
    if (a.folder === "latest") return -1;
    if (b.folder === "latest") return 1;
    return b.version.localeCompare(a.version);
  });

  // Aggiorna il menu a discesa
  $('#version-dropdown').empty();

  result.forEach(({ version, folder }) => {
    if (folder !== "latest") {
      $('#version-dropdown').append(`<option value="${folder}">${version}</option>`);
    } else {
      $('#version-dropdown').append(`<option value="${folder}">Latest</option>`);
    }
  });

  $('#version-dropdown').prop('disabled', false);
}

async function selectVersion() {
  folder = $('#version-dropdown').val();
  await initSchema(folder);
  enableValidation();
  await initFilesList(folder);
  cleanResult()
}