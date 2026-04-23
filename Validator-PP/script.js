var codeEditorTxt = "";
var ajv_validate;
var lineCountCache = 0;
var version = "0";
var autocomplete = "enabled";
var savedSchema = "";
var currentVersion = "latest";
var json = {};
var observer;
var customSchemaAvailable = false;
var customSchema = null;
var githubRateLimitHit = false;
var draft4MetaSchemaCache = null;
var examplesManifest = null;
var draftsManifest = null;
var currentExamplesVersion = "latest";
const openMenuBtn = document.getElementById('openMenuBtn');
const openExercisesMenuBtn = document.getElementById('openExercisesMenuBtn');
const contextMenuExamples = document.getElementById('contextMenuExamples');
const contextMenuExercises = document.getElementById('contextMenuExercises');

var i = 0;

var files = [];

var container = document.getElementById('jsoneditor');

const DRAFTS_BASE_CANDIDATES = ["./drafts/IDMEFv2"];
const EXAMPLES_BASE_CANDIDATES = ["./examples"];
const LATEST_SCHEMA_FOLDER = "latest-stable";
const LATEST_DEV_SCHEMA_FOLDER = "latest-dev";
const schemaURL = `${DRAFTS_BASE_CANDIDATES[0]}/${LATEST_SCHEMA_FOLDER}/IDMEFv2.schema`;
let validationEnabled = true;
var currentSchemaURI = `${DRAFTS_BASE_CANDIDATES[0]}/${LATEST_SCHEMA_FOLDER}/IDMEFv2.schema`;
let editor;

require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.38.0/min/vs' } });
require(["vs/editor/editor.main"], function () {

  async function initEditor() {
    const resolved = await resolveInitialSchema();

    if (!resolved) {
      console.error("Cannot load any valid schema from repo.");
      updateValidation(false, null);
      return;
    }

    updateValidation(validationEnabled, resolved.schema, resolved.url);

    fetchVersionFolderPairs();

    editor = monaco.editor.create(document.getElementById("jsoneditor"), {
      value: "{}",
      language: "json",
      theme: "vs-light"
    });

    if (resolved.folder !== "latest") {
      $("#warning-text").text(`Latest schema is invalid. Using ${resolved.folder} instead. If the issue persists, please open an issue on Github.`);
      showPopUp("warning-popup", 3000);
    }

    currentVersion = mapSchemaToFolder(resolved.folder);
    await initFilesList(resolved.folder);
    await initSchema(resolved.folder);
  }

  function updateValidation(enable, schema = null, schemaUri = schemaURL) {
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: enable,
      schemas: enable && schema ? [{
        uri: schemaUri,
        fileMatch: ["*"],
        schema: schema
      }] : []
    });
  }

  initEditor();
});

var jsonArray = [];

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

$('#version-dropdown').on('change', function () {
  const selectedValue = $(this).val();
  currentVersion = selectedValue === "custom" ? "custom" : mapSchemaToFolder(selectedValue);
  selectVersion();
});


$(document).ready(async function () {
  await loadExercisesFromFile();

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

  const schemaFileInput = document.getElementById('schemaFile');
  const schemaFileName = document.getElementById('schemaFileName');

  if (schemaFileInput && schemaFileName) {
    schemaFileInput.addEventListener('change', function (event) {
      const selectedFile = event.target.files[0];
      schemaFileName.value = selectedFile ? selectedFile.name : "";
    });
  }
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
function printExercise(exercise) {
  cleanResult()
  json = jsonArray.find(json => json.name == exercise);
  $('#selectedFileName').val(json.name);
  editor.setValue(JSON.stringify(json.json, null, 2));
}

// Cycles between the examples found inside the repository
async function printExample(example) {
  enableValidation();
  cleanResult();

  if (files.length > 0) {
    var localVersion = currentExamplesVersion || normalizeExamplesVersion(currentVersion);
    if (!localVersion) {
      console.error("Unable to resolve examples version from current schema selection");
      return;
    }

    const exampleResult = await tryLoadExampleFromCandidates(getExampleUrlCandidates(localVersion, example));
    if (!exampleResult) {
      console.error(`Unable to load example ${example} for ${localVersion}`);
      $("#warning-text").text(`Unable to load example ${example}. Please check repository paths.`);
      showPopUp("warning-popup", 3000);
      return;
    }

    json = exampleResult.data;
    $('#selectedFileName').val(example);
    editor.setValue(JSON.stringify(json, null, 2));
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

  if (typeof ajv_validate !== 'function') {
    result.innerHTML = `
      <p class="message">
        The selected schema could not be loaded for validation.<br>
        Please choose another schema version or upload a custom schema.
      </p>`;
    return;
  }

  json = editor.getValue()

  if (!json) {
    result.innerHTML = `
      <p class="message">
        No JSON data provided. Please enter valid JSON before running validation.
      </p>`;
    return;
  } else {

    try {
      var valid = ajv_validate(JSON.parse(json));
    } catch (e) {
      result.innerHTML = `
        <p class="message">
          The JSON format is invalid. Please check your syntax.<br>
          To help identify the issue, enable error highlighting using the button in the bottom-left corner.
        </p>`;
      return;
    }

    if (!valid) {
      ajv_validate.errors.forEach(function (err) {
        let path = err.dataPath ? err.dataPath.substr(1) : "Root";
        if (err.keyword === "additionalProperties") {
          path += "." + err.params.additionalProperty;
        }
        result.innerHTML += `Path: <b>${path}</b>, Error: ${err.message} <br/>`;
      });
    } else {
      result.innerHTML = "<p class=\"message\">The JSON is valid and conforms to the selected schema.</p>";
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

// Open Schema modal
function openSchemaUpload() {
  document.getElementById('schema-modal').style.display = "block";
  document.getElementById('overlay').style.display = "block";
}

function uploadSchema() {
  const schemaFileInput = document.getElementById('schemaFile');
  const schemaFileName = document.getElementById('schemaFileName');
  const selectedFile = schemaFileInput?.files?.[0];

  if (!selectedFile) {
    $("#warning-text").text("Please select a JSON schema file before confirming.");
    showPopUp("warning-popup", 3000);
    return;
  }

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const parsedSchema = JSON.parse(event.target.result);

      customSchemaAvailable = true;
      customSchema = {
        name: selectedFile.name,
        schema: parsedSchema
      };

      if (schemaFileName) {
        schemaFileName.value = selectedFile.name;
      }

      syncCustomSchemaOption();

      if (githubRateLimitHit) {
        enableCustomOnlyVersionDropdown();
        await initCustomSchema();
        closeModal();
        return;
      }

      // If user is already on custom, immediately re-apply updated schema.
      if ($('#version-dropdown').val() === 'custom') {
        await initCustomSchema();
      }

      closeModal();
    } catch (error) {
      customSchemaAvailable = false;
      customSchema = null;
      $("#warning-text").text("The selected file is not a valid JSON document.");
      showPopUp("warning-popup", 3000);
      console.error("Invalid custom schema JSON:", error);
    }
  };

  reader.readAsText(selectedFile);
}

function triggerSchemaFileUpload() {
  const schemaFileInput = document.getElementById('schemaFile');

  if (schemaFileInput) {
    schemaFileInput.click();
  }
}

function clearSchemaUpload() {
  const schemaFileInput = document.getElementById('schemaFile');
  const schemaFileName = document.getElementById('schemaFileName');

  if (schemaFileInput) {
    schemaFileInput.value = "";
  }

  if (schemaFileName) {
    schemaFileName.value = "";
  }
}

async function getExamplesManifest() {
  if (examplesManifest) {
    return examplesManifest;
  }

  examplesManifest = await $.getJSON("examples-manifest.json");
  return examplesManifest;
}

async function getDraftsManifest() {
  if (draftsManifest) {
    return draftsManifest;
  }

  draftsManifest = await $.getJSON("drafts-manifest.json");
  return draftsManifest;
}

async function getDraft4MetaSchema() {
  if (draft4MetaSchemaCache) {
    return draft4MetaSchemaCache;
  }

  draft4MetaSchemaCache = await $.getJSON("https://raw.githubusercontent.com/json-schema-org/json-schema-spec/draft-04/schema.json");
  return draft4MetaSchemaCache;
}

async function initCustomSchema() {
  if (!customSchemaAvailable || !customSchema || !customSchema.schema) {
    return false;
  }

  try {
    const metaschema = await getDraft4MetaSchema();
    savedSchema = customSchema.schema;

    var ajv = new Ajv({ schemaId: 'id', allErrors: true });
    ajv.addMetaSchema(metaschema);
    ajv_validate = ajv.compile(savedSchema);

    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: validationEnabled,
      schemas: [
        {
          uri: `custom://${customSchema.name}`,
          fileMatch: ["*"],
          schema: savedSchema
        }
      ]
    });

    $('#version-output').text(`Schema version custom (${customSchema.name})`);
      currentSchemaURI = `custom://${customSchema.name}`;
    $('#title').text('IDMEFv2 - JSON Validator - Custom Schema');
    return true;
  } catch (error) {
    ajv_validate = null;
    savedSchema = null;
    console.error("Error while applying custom schema:", error);
    $("#warning-text").text("Custom schema could not be applied.");
    showPopUp("warning-popup", 3000);
    return false;
  }
}

function syncCustomSchemaOption() {
  const dropdown = $('#version-dropdown');
  const optionValue = 'custom';
  const optionText = customSchemaAvailable && customSchema
    ? `Custom Schema - ${customSchema.name}`
    : 'Custom Schema';

  if (customSchemaAvailable && customSchema) {
    const existingOption = dropdown.find(`option[value="${optionValue}"]`);

    if (existingOption.length > 0) {
      existingOption.text(optionText);
    } else {
      dropdown.append(`<option value="${optionValue}">${optionText}</option>`);
    }
  } else {
    dropdown.find(`option[value="${optionValue}"]`).remove();
  }
}

function enableCustomOnlyVersionDropdown() {
  if (!customSchemaAvailable || !customSchema) {
    return;
  }

  const dropdown = $('#version-dropdown');
  dropdown.empty();
  dropdown.append(`<option value="custom">Custom Schema - ${customSchema.name}</option>`);
  dropdown.val('custom');
  dropdown.prop('disabled', false);
  currentVersion = 'custom';
}

function setVersionDropdownRateLimitState() {
  const dropdown = $('#version-dropdown');
  dropdown.empty();
  dropdown.append('<option value="latest">Schema list unavailable (GitHub API limit)</option>');
  dropdown.prop('disabled', true);
  $("#warning-text").text("GitHub API rate limit reached (403). Upload a custom schema to continue.");
  showPopUp("warning-popup", 3500);
}

// Close all modals and remove the overlay
function closeModal() {
  document.getElementById('overlay').style.display = "none";
  document.getElementById('save-modal').style.display = "none";
  document.getElementById('schema-modal').style.display = "none";
  document.getElementById('fileName').value = "";
  clearSchemaUpload();
}

// Function to recover the file names from github
async function initFilesList(version = "latest") {
  const normalizedVersion = normalizeExamplesVersion(version);
  let resolvedExamplesVersion = normalizedVersion;

  const manifest = await getExamplesManifest();
  let fileNames = manifest[normalizedVersion];

  if (!fileNames) {
    $("#warning-text").text(`No examples available for ${normalizedVersion}, displaying latest.`);
    showPopUp("warning-popup", 3000);
    fileNames = manifest["latest"] || [];
    resolvedExamplesVersion = "latest";
  }

  currentExamplesVersion = resolvedExamplesVersion;

  files = fileNames;
  const filesMenu = document.getElementById("contextMenuExamplesUl");
  filesMenu.innerHTML = "";

  fileNames.forEach(fileName => {
    const listItem = document.createElement("li");
    listItem.classList.add("context-option");
    listItem.setAttribute("data-value", fileName);
    listItem.textContent = fileName;
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
  const resolvedFolder = resolveSchemaFolderPath(folder);

  try {
    const metaschema = await getDraft4MetaSchema();
    const schemaResult = await tryLoadSchemaFromCandidates(getSchemaUrlCandidates(resolvedFolder));

    if (!schemaResult) {
      throw new Error(`Schema file not found for folder ${resolvedFolder}`);
    }

    const schema = schemaResult.schema;
    const localSchemaURL = schemaResult.url;

    savedSchema = schema;
    currentSchemaURI = localSchemaURL;
    const description = schema.description;

    const regex = /revision\s([\w\.]+)\)/;
    const match = description.match(regex);

    if (match) {
      const version = match[1];
      $('#autocomplete').text('enabled');
      $('#version-output').text('Schema version ' + version);
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
          uri: localSchemaURL,
          fileMatch: ["*"],
          schema: savedSchema
        }
      ]
    });
    return true;
  } catch(e) {
    ajv_validate = null;
    savedSchema = null;
    console.error(e);
    $("#warning-text").text(`Schema ${resolvedFolder} is invalid or cannot be loaded. Validation is disabled until a valid schema is selected.`);
    showPopUp("warning-popup", 3000);
    return false;
  }
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
        uri: currentSchemaURI,
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
          uri: schemaURL,
          fileMatch: ["*"],
        },
      ]
      : [],
  });
}

// Function to toggle validation state
function toggleAutocomplete() {
  const autocompleteButton = $('#autocomplete'); // Get the button element
  const isEnabled = autocompleteButton.text() === 'enabled'; // Check current text

  if (isEnabled) {
    disableValidation();
  } else {
    enableValidation();
  }
}

async function fetchVersionFolderPairs() {
  const versionMap = new Map();

  const folders = await listDraftFolders();

  folders.sort((a, b) => {
    if (a === LATEST_SCHEMA_FOLDER) return -1;
    if (b === LATEST_SCHEMA_FOLDER) return 1;
    if (a === LATEST_DEV_SCHEMA_FOLDER) return -1;
    if (b === LATEST_DEV_SCHEMA_FOLDER) return 1;
    return a.localeCompare(b);
  });

  const validFolders = folders.filter(folder => {
    return folder === LATEST_SCHEMA_FOLDER || folder === LATEST_DEV_SCHEMA_FOLDER || parseInt(folder, 10) >= 4;
  });

  for (const folder of validFolders) {
    try {
      const schemaResult = await tryLoadSchemaFromCandidates(getSchemaUrlCandidates(folder));
      const schema = schemaResult ? schemaResult.schema : null;

      if (!schema) {
        continue;
      }

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

  const result = Array.from(versionMap.entries())
    .map(([version, folder]) => ({ version, folder }))
    .sort((a, b) => (a.version > b.version ? 1 : -1));

  result.sort((a, b) => {
    if (a.folder === LATEST_SCHEMA_FOLDER) return -1;
    if (b.folder === LATEST_SCHEMA_FOLDER) return 1;
    if (a.folder === LATEST_DEV_SCHEMA_FOLDER) return -1;
    if (b.folder === LATEST_DEV_SCHEMA_FOLDER) return 1;
    return b.version.localeCompare(a.version);
  });

  $('#version-dropdown').empty();

  result.forEach(({ version, folder }) => {
    const optionValue = getFrontendSchemaValue(folder);
    const optionLabel = getSchemaDropdownLabel(version, folder);
    $('#version-dropdown').append(`<option value="${optionValue}">${optionLabel}</option>`);
  });

  githubRateLimitHit = false;
  syncCustomSchemaOption();
  $('#version-dropdown').prop('disabled', false);
}

async function selectVersion() {
  const folder = $('#version-dropdown').val();

  if (folder === 'custom') {
    if (!customSchemaAvailable || !customSchema) {
      $("#warning-text").text("No custom schema available. Please upload one first.");
      showPopUp("warning-popup", 3000);
      return;
    }

    const customSchemaLoaded = await initCustomSchema();

    if (!customSchemaLoaded) {
      disableValidation();
      cleanResult();
      return;
    }

    enableValidation();
    cleanResult();
    return;
  }

  const schemaLoaded = await initSchema(folder);

  if (!schemaLoaded) {
    disableValidation();
    cleanResult();
    return;
  }

  enableValidation();
  await initFilesList(folder);
  cleanResult();
}

async function loadExercisesFromFile() {
  try {
    const response = await fetch("Exercises/Exercises.json");
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    jsonArray = await response.json();

    const ExercisesMenu = document.getElementById("contextMenuExercisesUl");
    ExercisesMenu.innerHTML = "";

    jsonArray.forEach(file => {
      const listItem = document.createElement("li");
      listItem.classList.add("context-option");
      listItem.setAttribute("data-value", file.name);
      listItem.textContent = file.name;
      ExercisesMenu.appendChild(listItem);
    });

  } catch (error) {
    console.error("An error has occurred while loading the exercises:", error);
  }
}

function mapSchemaToFolder(value) {
  if (value.toLowerCase() === "latest" || value.toLowerCase() === LATEST_SCHEMA_FOLDER) {
    return "latest";
  }
  if (value.toLowerCase() === LATEST_DEV_SCHEMA_FOLDER) {
    return LATEST_DEV_SCHEMA_FOLDER;
  }
  if (value.toLowerCase() === "custom") {
    return "custom";
  }
  const devMatch = value.match(/^(?:V)?(\d+)-dev$/i);
  if (devMatch) {
    return `V${parseInt(devMatch[1], 10)}-Dev`;
  }
  return "V" + parseInt(value, 10);
}

function resolveSchemaFolderPath(folderValue) {
  const normalized = String(folderValue).trim();

  if (normalized.toLowerCase() === "latest" || normalized.toLowerCase() === LATEST_SCHEMA_FOLDER) {
    return LATEST_SCHEMA_FOLDER;
  }

  return normalized;
}

function getFrontendSchemaValue(folderName) {
  return folderName === LATEST_SCHEMA_FOLDER ? "latest" : folderName;
}

function getSchemaDropdownLabel(version, folderName) {
  if (folderName === LATEST_SCHEMA_FOLDER) {
    return `Latest Schema - ${version}`;
  }

  if (folderName === LATEST_DEV_SCHEMA_FOLDER) {
    return `Latest Dev Schema - ${version}`;
  }

  if (/\-Dev$/i.test(folderName)) {
    return `${version} - Dev`;
  }

  return version;
}

function normalizeExamplesVersion(versionValue) {
  if (!versionValue) {
    return null;
  }

  const normalized = String(versionValue).trim();
  if (normalized.toLowerCase() === "latest") {
    return "latest";
  }

  if (normalized.toLowerCase() === LATEST_DEV_SCHEMA_FOLDER) {
    return "latest";
  }

  const vMatch = normalized.match(/^V(\d+)$/i);
  if (vMatch) {
    return `V${parseInt(vMatch[1], 10)}`;
  }

  const vDevMatch = normalized.match(/^V(\d+)-Dev$/i);
  if (vDevMatch) {
    return `V${parseInt(vDevMatch[1], 10)}`;
  }

  const devMatch = normalized.match(/^(\d+)-Dev$/i);
  if (devMatch) {
    return `V${parseInt(devMatch[1], 10)}`;
  }

  if (/^\d+$/.test(normalized)) {
    return `V${parseInt(normalized, 10)}`;
  }

  return null;
}

async function fetchTextOrThrow(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

function getSchemaUrlCandidates(folder) {
  const candidates = [];

  DRAFTS_BASE_CANDIDATES.forEach((basePath) => {
    candidates.push(`${basePath}/${folder}/IDMEFv2.schema`);
    candidates.push(`${basePath}/${folder}/idmefv2.schema`);
  });

  return candidates;
}

function getExampleUrlCandidates(version, example) {
  return EXAMPLES_BASE_CANDIDATES.map(basePath => `${basePath}/${version}/${example}`);
}

async function tryLoadSchema(url) {
  try {
    const text = await fetchTextOrThrow(url);
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
}

async function tryLoadSchemaFromCandidates(urls) {
  for (const url of urls) {
    const schema = await tryLoadSchema(url);
    if (schema) {
      return { schema, url };
    }
  }

  return null;
}

async function tryLoadExampleFromCandidates(urls) {
  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      return { data, url };
    } catch (e) {
      // Keep trying fallback paths.
    }
  }

  return null;
}

async function listDraftFolders() {
  const manifest = await getDraftsManifest();
  return Array.isArray(manifest?.folders) ? manifest.folders : [];
}

function sortFoldersForFallback(folders) {
  return folders
    .filter(folder => folder === LATEST_DEV_SCHEMA_FOLDER || /^\d+$/.test(folder) || /^\d+-Dev$/i.test(folder))
    .map(folder => {
      if (folder === LATEST_DEV_SCHEMA_FOLDER) {
        return {
          folder,
          version: Number.MAX_SAFE_INTEGER,
          isDev: true
        };
      }

      const match = folder.match(/^(\d+)(-Dev)?$/i);
      return {
        folder,
        version: match ? parseInt(match[1], 10) : -1,
        isDev: /-Dev$/i.test(folder)
      };
    })
    .filter(entry => entry.version >= 4)
    .sort((a, b) => {
      if (a.version !== b.version) {
        return b.version - a.version;
      }

      if (a.isDev === b.isDev) {
        return a.folder.localeCompare(b.folder);
      }

      return a.isDev ? -1 : 1;
    })
    .map(entry => entry.folder);
}

async function resolveInitialSchema() {
  const latestResult = await tryLoadSchemaFromCandidates(getSchemaUrlCandidates(LATEST_SCHEMA_FOLDER));
  if (latestResult) {
    return { folder: "latest", url: latestResult.url, schema: latestResult.schema };
  }

  const folders = await listDraftFolders();
  const candidates = sortFoldersForFallback(folders);

  for (const folder of candidates) {
    const schemaResult = await tryLoadSchemaFromCandidates(getSchemaUrlCandidates(folder));
    if (schemaResult) {
      return { folder, url: schemaResult.url, schema: schemaResult.schema };
    }
  }

  return null;
}
