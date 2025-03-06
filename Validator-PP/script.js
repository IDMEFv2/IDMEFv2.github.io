var codeEditorTxt = "";
var ajv_validate;
var lineCountCache = 0;
var version = "0";
var savedSchema = "";
var json = {};
var observer;
var validationPerformed = false;
const openMenuBtn = document.getElementById('openMenuBtn');
const contextMenu = document.getElementById('contextMenu');

var i = 0;

var files = [];

var mode = 'code';
var options = {
  mode: mode
};
var container = document.getElementById('jsoneditor');
var editor = new JSONEditor(container, options);

var jsonbase = {
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
};

const toggleButton = document.getElementById('dark-mode-toggle');
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
});

$(document).ready(async function() {
  await initFilesList();

  initObserver();
  editor.set(json);

  await initSchema()

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
          stopObserver();
          clearErrorHighlights();
          editor.set(json);
          validationPerformed = false;
          startObserver();
        } catch (error) {
          console.error("Error parsing JSON:", error);
        }
      };

      reader.readAsText(file);
    }
  });
});

// Functions related to the Observer

function initObserver() {
  observer = new MutationObserver(() => {
    if (validationPerformed) {
      findErrors();
    }
  });
  observer.observe(container, { childList: true, subtree: true });
}

function stopObserver() {
  if (observer) {
    observer.disconnect();
  }
}

function startObserver() {
  if (observer) {
    observer.observe(container, { childList: true, subtree: true });
  }
}

// ---------------------------

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
function printExercise() {
  cleanResult()
  clearErrorHighlights();
  stopObserver();
  json = jsonbase;
  editor.set(json);
  validationPerformed = false;
  startObserver();
}

// Cycles between the examples found inside the repository
function printExample(example) {
  cleanResult();
  clearErrorHighlights();
  stopObserver();

  if(files.length > 0) {

    var url = `https://raw.githubusercontent.com/IDMEFv2/IDMEFv2-Examples/refs/heads/main/latest/` + example;

    $.getJSON(url, function(example) {
      json = example;
      editor.set(json);
      validationPerformed = false;
      startObserver();
    });

  } else {
    console.error("No files have been found inside the repository");
  }
}

// Save the file in the chosen format and close the modal
function saveFileAs() {
  var currentJson = editor.get();
  var jsonString = JSON.stringify(currentJson, null, 2);
  let format = document.getElementById("format").value;
  let fileName = document.getElementById("fileName").value;
  
  if (fileName === "") {
    const timestamp = new Date().toISOString().replace(/[-:.]/g, "");
    fileName = `IDMEFv2_${timestamp}`;
  }

  var defaultFilename = format === ".json" ? `${fileName}.json` : `${fileName}.txt`;

  var textBlob = new Blob([jsonString], { type: 'application/json' });
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
  var currentJson = editor.get(); 

  var jsonString = JSON.stringify(currentJson, null, 2); 

  var tempInput = document.createElement("textarea");
  tempInput.style.position = "absolute";
  tempInput.style.opacity = "0";
  document.body.appendChild(tempInput);

  tempInput.value = jsonString;

  tempInput.select();
  tempInput.setSelectionRange(0, 99999);

  document.execCommand("copy");

  document.body.removeChild(tempInput);
  showPopUp("success-popup", 3000);
}

function clear_text() {
  cleanResult()
  clearErrorHighlights();
  stopObserver();
  json = {};
  editor.set(json);
  validationPerformed = false; 
  startObserver();
}

// Change the way the json is desplayed
function changeMode() {
  var modeValue = document.getElementById("mode").value;
  mode = modeValue;

  editor.setMode(modeValue);
}

function validate() {
  let result = document.getElementById("idmefv2_text_result");
  result.innerHTML = "";
  clearErrorHighlights();
  
  json = JSON.stringify(editor.get());

  if (!json) { 
    result.innerHTML = "<p class=\"noerrors\">No data provided to validate.</p>";
    return;
  } else {
    validationPerformed = true; 
    stopObserver();

    var valid = ajv_validate(JSON.parse(json));
    if (!valid) {
      ajv_validate.errors.forEach(function (err) {
        let path = err.dataPath ? err.dataPath.substr(1) : "Root";
        if (err.keyword === "additionalProperties") {
          path += "." + err.params.additionalProperty;
        }
        result.innerHTML += `Path: <a href="#" class="modal-link" onclick="showSchema('${path}')">${path}</a>, Error: ${err.message} <br/>`;
      });
      findErrors();
    } else {
      result.innerHTML = "<p class=\"noerrors\">No errors</p>";
      stopObserver();
    }
  }
}

// ---------------------

// Functions related to highlighting the errors in the editor

function findErrors() {
  ajv_validate.errors.forEach(highlightError);
}

function highlightError(error) {
  let path;

  if (error.dataPath === "") {
    path = error.params.additionalProperty; 
  } else {
    path = error.dataPath.substr(1);
  }

  const lastDotIndex = path.lastIndexOf('.');
  const lastPart = lastDotIndex !== -1 ? path.substring(lastDotIndex + 1) : path;

  const bracketIndex = lastPart.indexOf('[');
  const finalPart = bracketIndex !== -1 ? lastPart.substring(0, bracketIndex) : lastPart;

  if(mode == "code") {
    const variableElements = document.querySelectorAll('.ace_variable');
  
    variableElements.forEach(element => {
      if (element.textContent.includes(finalPart)) {
        element.classList.add('error-found');
      }
    });
  } else if(mode == "tree" || mode == "view") {
    
    const variableElements = document.querySelectorAll('.jsoneditor-field');

    variableElements.forEach(element => {
      if (element.textContent.includes(finalPart)) {
        element.classList.add('error-found');
      }
    });
  }
}

function clearErrorHighlights() {
  const highlightedElements = document.querySelectorAll('.error-found');

  highlightedElements.forEach(element => {
    element.classList.remove('error-found');
  });
}

// -----------------

function cleanResult() {
  let result = document.getElementById("idmefv2_text_result");

  result.innerHTML = "";
}

function openCloseInfo() {
  let arrow = document.getElementById("arrow");
  let content = document.getElementById("info-content");

  if (!arrow.classList.contains("rotated")) {
    content.classList.remove("no-border");
    arrow.classList.add("rotated");
    content.classList.remove("info-invisible");
    content.classList.add("info-visible");
  } else {
    arrow.classList.remove("rotated");
    content.classList.remove("info-visible");
    content.classList.add("info-invisible");
    content.addEventListener('transitionend', function handleTransitionEnd() {
      content.classList.add("no-border");
      content.removeEventListener('transitionend', handleTransitionEnd);
    });
  }
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
async function initFilesList() {
  const apiUrl = "https://api.github.com/repos/IDMEFv2/IDMEFv2-Examples/contents/latest";

  await $.getJSON(apiUrl, function(data) {
    files = data.map(file => file.name);
    filesMenu = document.getElementById("contextMenuUl");
    filesMenu.innerHTML = "";

    data.forEach(file => {
      const listItem = document.createElement("li");
      listItem.classList.add("context-option");
      listItem.setAttribute("data-value", file.name);
      listItem.textContent = file.name;
      filesMenu.appendChild(listItem);
    });
  }).fail(function() {
    return [];
  });
}

// Preparing the schema for validation
async function initSchema() {
  await $.getJSON('https://raw.githubusercontent.com/json-schema-org/json-schema-spec/draft-04/schema.json', async function (metaschema) {
    await $.getJSON('https://raw.githubusercontent.com/IDMEFv2/IDMEFv2-Drafts/refs/heads/main/IDMEFv2/latest/IDMEFv2.schema', function (schema) {
      savedSchema = schema;
      console.log(schema)
      const description = schema.description;
  
      // Using a regex to extract the schema version
      const regex = /revision\s([\w\.]+)\)/;
      const match = description.match(regex);
  
      if (match) {
        const version = match[1];
  
        $('#version-output').text('Version ' + version);
        $('#title').text('IDMEFv2 - JSON Validator - Version ' + version);
      } else {
        console.log('No revision has been found');
      }
  
      var ajv = new Ajv({ schemaId: 'id', allErrors: true });
      ajv.addMetaSchema(metaschema);
      ajv_validate = ajv.compile(schema);
    });
  });
}

openMenuBtn.addEventListener('click', (event) => {
  event.stopPropagation();

  const rect = openMenuBtn.getBoundingClientRect();
  contextMenu.style.top = `${rect.bottom + window.scrollY}px`;
  contextMenu.style.left = `${rect.left}px`;

  contextMenu.classList.toggle("menu-hidden");
});

document.getElementById("contextMenuUl").addEventListener("click", (e) => {
  if (e.target.classList.contains("context-option")) {
    const selectedValue = e.target.getAttribute("data-value");
    printExample(selectedValue);

    document.getElementById("contextMenu").classList.add("menu-hidden");
  }
});

document.addEventListener('click', (e) => {
  if (!contextMenu.contains(e.target) && e.target !== openMenuBtn) {
    contextMenu.classList.add("menu-hidden");
  }
});

