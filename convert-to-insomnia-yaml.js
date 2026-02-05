const fs = require('fs');
const yaml = require('js-yaml');

// Ler a collection JSON
const data = JSON.parse(fs.readFileSync('insomnia-collection.json', 'utf8'));

// Separar recursos
const root = data.resources.find(r => r._id === 'fld_root');
const folders = data.resources.filter(r => r._type === 'request_group' && r._id !== 'fld_root');
const requests = data.resources.filter(r => r._type === 'request');

// Função para converter request para formato YAML do Insomnia
function convertRequest(req) {
  const yamlReq = {
    url: req.url,
    name: req.name,
    meta: {
      id: req._id,
      created: req.created,
      modified: req.modified,
      isPrivate: req.isPrivate || false,
      description: req.description || '',
      sortKey: req.metaSortKey || -req.created
    },
    method: req.method,
    headers: (req.headers && req.headers.length > 0) 
      ? req.headers.map(h => ({
          name: h.name,
          value: h.value,
          description: h.description || '',
          disabled: false
        }))
      : [
          {
            name: 'User-Agent',
            value: 'insomnia/12.2.0',
            description: '',
            disabled: false
          }
        ],
    settings: {
      renderRequestBody: !req.settingDisableRenderRequestBody,
      encodeUrl: req.settingEncodeUrl !== false,
      followRedirects: req.settingFollowRedirects || 'global',
      cookies: {
        send: req.settingSendCookies !== false,
        store: req.settingStoreCookies !== false
      },
      rebuildPath: req.settingRebuildPath !== false
    }
  };

  // Adicionar body se houver
  if (req.body && req.body.text) {
    yamlReq.body = {
      mimeType: req.body.mimeType || 'application/json',
      text: req.body.text
    };
  }

  return yamlReq;
}

// Função para converter folder para formato YAML do Insomnia
function convertFolder(folder, requestsInFolder) {
  return {
    name: folder.name,
    meta: {
      id: folder._id,
      created: folder.created,
      modified: folder.modified,
      description: folder.description || '',
      sortKey: folder.metaSortKey || -folder.created
    },
    children: requestsInFolder.map(convertRequest)
  };
}

// Organizar requests por pasta
const requestsByFolder = {};
requests.forEach(req => {
  const folderId = req.parentId || 'fld_root';
  if (!requestsByFolder[folderId]) {
    requestsByFolder[folderId] = [];
  }
  requestsByFolder[folderId].push(req);
});

// Requests na raiz
const rootRequests = requestsByFolder['fld_root'] || [];

// Criar estrutura YAML
const yamlStructure = {
  type: 'collection.insomnia.rest/5.0',
  schema_version: '5.1',
  name: root.name,
  meta: {
    id: root._id,
    created: root.created,
    modified: root.modified,
    description: root.description || ''
  },
  collection: [
    ...rootRequests.map(convertRequest),
    ...folders.map(folder => convertFolder(folder, requestsByFolder[folder._id] || []))
  ],
  cookieJar: {
    name: 'Default Jar',
    meta: {
      id: 'jar_default',
      created: Date.now(),
      modified: Date.now()
    }
  },
  environments: {
    name: 'Base Environment',
    meta: {
      id: 'env_base',
      created: Date.now(),
      modified: Date.now(),
      isPrivate: false
    },
    data: root.environment || {}
  }
};

// Converter para YAML usando js-yaml
const yamlContent = yaml.dump(yamlStructure, {
  indent: 2,
  lineWidth: -1,
  noRefs: true,
  sortKeys: false,
  quotingType: '"',
  forceQuotes: false
});

// Salvar como YAML
fs.writeFileSync('insomnia-collection.yaml', yamlContent);
console.log('✅ Collection convertida para insomnia-collection.yaml!');
console.log(`📊 Total: ${rootRequests.length} requests na raiz, ${folders.length} folders, ${requests.length} requests total`);
