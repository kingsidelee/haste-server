let paste = function () {
  this.inputArea = document.querySelector('#inputArea');
  this.label = document.querySelector('#inputAreaLabel');
  this.configureButtons();
}

let paste_document = function () {
  this.locked = false;
};

// Get this document from the server and lock it here
paste_document.prototype.load = async function (key, callback) {
  await fetch('/documents/' + key, {
    method: 'GET',
    mode: 'cors',
    headers: {
      'Content-Type': 'application/json'
    }
  }).then(response => {
    if (!response.ok) {
      if (response.status == 404) {
        info = 'Document not found.';
        alert(info);
        throw new Error(info);
      }
      else {
        throw new Error('Load response was not OK.');
      }
    }
    return response.json();
  }).then(obj => {
    this.locked = true;
    this.key = key;
    this.data = obj.data;
    callback({ value: obj.data, key: key });
  }).catch(error => {
    console.error(error);
  });
};

// Save this document to the server and lock it here
paste_document.prototype.save = async function (data, callback) {
  if (this.locked) {
    return false;
  }
  this.data = data;
  await fetch('/documents', {
    method: 'POST',
    mode: 'cors',
    headers: {
      'Content-Type': 'text/plain; charset=utf-8'
    },
    body: data
  }).then(response => {
    if (!response.ok) {
      if (response.status == 400) {
        info = 'Document exceeds maximum length.';
        alert(info);
        throw new Error(info);
      }
      else {
        throw new Error('Save response was not OK.');
      }
    }
    return response.json();
  }).then(obj => {
    this.locked = true;
    this.key = obj.key;
    this.data = obj.data;
    callback(null, { value: obj.data, key: obj.key });
  }).catch(error => {
    console.error(error);
  });
};

// Remove the current document (if there is one)
// and set up for a new one
paste.prototype.newDocument = function (hideHistory) {
  this.doc = new paste_document();
  if (!hideHistory) {
    this.inputArea.readOnly = false;
    this.label.textContent = 'New Paste';
    window.history.pushState(null, '', '/');
  }
  this.inputArea.value = '';
};

// Load a document and show it
paste.prototype.loadDocument = function (key) {
  // Ask for what we want
  this.doc = new paste_document();
  this.doc.load(key, ret => {
    if (ret) {
      this.inputArea.value = ret.value;
      this.inputArea.readOnly = true;
      this.label.textContent = 'Paste: ' + key;
    }
    else {
      this.newDocument();
    }
  });
};

// Duplicate the current document - only if locked
paste.prototype.duplicateDocument = function () {
  if (this.doc.locked) {
    const currentData = this.doc.data;
    this.newDocument();
    this.inputArea.value = currentData;
  }
};

// Lock the current document
paste.prototype.lockDocument = function () {
  this.doc.save(this.inputArea.value, (err, ret) => {
    if (err) {
      this.showMessage(err.message, 'error');
    }
    else if (ret) {
      this.inputArea.readOnly = true;
      this.label.textContent = 'Paste: ' + ret.key;
      window.history.pushState(null, '', '/' + ret.key);
    }
  });
};

paste.prototype.configureButtons = function () {
  this.buttons = [
    {
      where: document.querySelector('#save'),
      action: () => {
        if (this.inputArea.value.replace(/^\s+|\s+$/g, '') !== '') {
          this.lockDocument();
        }
      }
    },
    {
      where: document.querySelector('#new'),
      action: () => {
        this.newDocument(!this.doc.key);
      }
    },
    {
      where: document.querySelector('#dup'),
      action: () => {
        this.duplicateDocument();
      }
    },
    {
      where: document.querySelector('#raw'),
      action: () => {
        if (this.doc.key) {
          window.location.href = '/raw/' + this.doc.key;
        }
      }
    },
    {
      where: document.querySelector('#url'),
      action: () => {
        if (this.doc.key) {
          navigator.clipboard.writeText(window.location.href).then(() => {
            alert('Successfully write to clipboard.');
          }, () => {
            alert('Write to clipboard failed.');
          });
        }
      }
    }
  ];
  for (const button of this.buttons) {
    this.configureButton(button);
  }
};

paste.prototype.configureButton = (options) => {
  // Handle the click action
  options.where.addEventListener('pointerdown', options.action);
};

const app = new paste();
app.newDocument(true);

// Handle pops
var handlePop = function (evt) {
  var path = evt.target.location.pathname;
  if (path === '/') { app.newDocument(true); }
  else { app.loadDocument(path.substring(1, path.length)); }
};
// Set up the pop state to handle loads, skipping the first load
// to make chrome behave like others:
// http://code.google.com/p/chromium/issues/detail?id=63040
setTimeout(function () {
  window.onpopstate = function (evt) {
    try { handlePop(evt); } catch (err) { /* not loaded yet */ }
  };
}, 1000);

handlePop({ target: window });