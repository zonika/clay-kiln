import _ from 'lodash';
import { removeElement, find } from '@nymag/dom';
import { UPDATE_COMPONENT, REVERT_COMPONENT, RENDER_COMPONENT, REMOVE_COMPONENT } from './mutationTypes';
import { getData, getModel, getTemplate, getSchema } from '../core-data/components';
import { getComponentName, refProp, refAttr, layoutAttr, editAttr, componentListProp, componentProp } from '../utils/references';
import { save as modelSave, render as modelRender } from './model';
import { save, saveForHTML, getObject } from '../core-data/api';
import { add as addToQueue } from '../core-data/queue';
import label from '../utils/label';
import { getComponentEl, getParentComponent, getPrevComponent } from '../utils/component-elements';
import getAvailableComponents from './available-components';
import create from './create';

/**
 * log errors when components save and display them to the user
 * @param  {string} uri
 * @param  {Error} e
 * @param  {object} store
 */
function logSaveError(uri, e, store) {
  console.error(`Error saving component (${getComponentName(uri)}):`, e);
  store.dispatch('showStatus', { type: 'error', message: `Changes made to ${label(getComponentName(uri))} were not saved!` });
}

/**
 * save data client-side and queue up api call for the server
 * note: this uses the components' model.js and handlebars template
 * @param  {string} uri
 * @param  {object} data
 * @param {object} oldData
 * @param {object} store
 * @return {Promise}
 */
function clientSave(uri, data, oldData, store) {
  return modelSave(uri, data)
    .then((savedData) => {
      // kick api call off in the background
      addToQueue(save, [uri, data])
        // note: we don't care about the data we got back from the api
        .catch((e) => {
          store.commit(REVERT_COMPONENT, {uri, oldData});
          store.commit(RENDER_COMPONENT, { uri, data: oldData });
          logSaveError(uri, e, store, store);
        });

      return savedData;
    })
    .then((savedData) => modelRender(uri, savedData))
    .then((renderableData) => {
      store.commit(UPDATE_COMPONENT, {uri, data: renderableData});
      store.commit(RENDER_COMPONENT, { uri, data: renderableData });
      return renderableData;
    });
}

/**
 * save data server-side, but re-render client-side afterwards
 * note: this uses deprecated server.js, but renders with handlebars template
 * @param  {string} uri
 * @param  {object} data
 * @param {object} oldData
 * @param {object} store
 * @return {Promise}
 */
function serverSave(uri, data, oldData, store) {
  return addToQueue(save, [uri, data])
    .then((res) => {
      store.commit(UPDATE_COMPONENT, {uri, data: res});
      store.commit(RENDER_COMPONENT, { uri, data: res });
      return res;
    })
    .catch((e) => {
      store.commit(REVERT_COMPONENT, {uri, oldData});
      store.commit(RENDER_COMPONENT, { uri, data: oldData });
      logSaveError(uri, e, store);
    });
}

/**
 * save data AND re-render server-side
 * note: this uses deprecated server.js and deprecated server-dependent template
 * @param  {string} uri
 * @param  {object} data
 * @param {object} oldData
 * @param {object} store
 * @return {Promise}
 */
function serverSaveAndRerender(uri, data, oldData, store) {
  const oldHTML = find(`[${refAttr}="${uri}"]`).cloneNode(true);

  return addToQueue(saveForHTML, [uri, data])
    .then((html) => { // PUT to html before getting new data
      return addToQueue(getObject, [uri])
        .then((res) => {
          store.commit(UPDATE_COMPONENT, {uri, data: res});
          store.commit(RENDER_COMPONENT, { uri, html });
          return res;
        })
        // otherwise revert the data
        .catch((e) => {
          store.commit(REVERT_COMPONENT, {uri, oldData});
          store.commit(RENDER_COMPONENT, { uri, html: oldHTML });
          logSaveError(uri, e, store);
        });
    });
}

/**
 * save a component's data and re-render
 * @param {object} store
 * @param  {string} uri
 * @param  {object} data (may be a subset of the data)
 * @return {Promise}
 */
export function saveComponent(store, {uri, data}) {
  const oldData = getData(uri),
    dataToSave = _.assign({}, oldData, data),
    model = getModel(uri),
    template = getTemplate(uri);

  let promise;

  if (dataToSave[refProp]) {
    // never send _ref to the server
    delete dataToSave[refProp];
  }

  if (model && template) {
    // component has both model and template, so we can do optimistic save + re-rendering
    promise = clientSave(uri, dataToSave, oldData, store);
  } else if (template) {
    // component only has handlebars template, but still has a server.js.
    // send data to the server, then re-render client-side with the returned data
    promise = serverSave(uri, dataToSave, oldData, store);
    console.warn(`${getComponentName(uri)}/server.js is deprecated and will be removed in the next major release`);
  } else {
    // component has server dependencies for their logic (server.js) and template.
    // send data to the server and get the new html back, then send an extra GET to update the store
    promise = serverSaveAndRerender(uri, dataToSave, oldData, store);
    console.warn(`${getComponentName(uri)}/server.js and non-handlebars templates are deprecated and will be removed in the next major release`);
  }

  return promise;
}

/**
 * remove a component from its parent
 * note: removes from parent component OR page
 * @param  {object} store
 * @param  {Element} el    inside the component to delete
 * @return {Promise}
 */
export function removeComponent(store, el) {
  const componentEl = getComponentEl(el),
    uri = componentEl.getAttribute(refAttr),
    parentEl = getParentComponent(componentEl),
    parentURI = parentEl.getAttribute(layoutAttr) || parentEl.getAttribute(refAttr),
    path = componentEl.parentNode.getAttribute(editAttr),
    list = getData(parentURI, path),
    prevURI = getPrevComponent(componentEl) && getPrevComponent(componentEl).getAttribute(refAttr);

  let newList = [],
    promise;

  if (_.isArray(list)) {
    // list in a component
    let currentData = _.find(list, (item) => item[refProp] === uri);

    newList = _.without(list, currentData);
    promise = saveComponent(store, { uri: parentURI, data: { [path]: newList } });
  } else if (_.isObject(list)) {
    console.error('Removing components from props (without replacing them) is not currently supported!');
  } else if (_.isString(list)) {
    // list in a page
    newList = _.without(list, uri); // we only need the uri, not a full object
    // manually remove component from dom, then update the page data
    removeElement(componentEl);
    promise = store.dispatch('savePage', { [path]: newList });
  }

  return promise.then(() => {
    store.commit(REMOVE_COMPONENT, {uri});
    return find(`[${refAttr}="${prevURI}"]`);
  });
}

/**
 * find the index of a uri in a list
 * this is broken out into a separate function so we don't assume an index of 0 is falsy
 * @param  {array} data
 * @param  {string} [uri]
 * @return {number}
 */
function findIndex(data, uri) {
  let index;

  if (_.isString(data[0])) {
    // array of strings!
    index = _.findIndex(data, uri);
  } else {
    // array of objects with refs
    index = _.findIndex(data, (item) => item[refProp] === uri);
  }

  // 0 is a perfectly valid index! (so we can't just check for falsy)
  // note: check for uri first, since if we know we're adding it to the end we don't
  // want to search through the whole array
  return uri && index > -1 ? index : data.length - 1;
}

/**
 * add one or more components to a component list
 * @param {object} store
 * @param {array} data       list data
 * @param {string} [currentURI] if you want to add after / replace a specific current component
 * @param {string} parentURI
 * @param {string} path       of the list
 * @param {boolean} [replace]    to replace currentURI
 * @param {array} components with { name, [data] }
 * @returns {Promise}
 */
function addComponentsToComponentList(store, data, {currentURI, parentURI, path, replace, components}) {
  const index = findIndex(data, currentURI); // get the index before we manipulate the list

  return create(components)
    .then((newComponents) => {
      let newList;

      if (replace) {
        // replace current uri when creating new list
        newList = _.slice(data, 0, index).concat(newComponents).concat(_.slice(data, index + 1));
      } else {
        // just add new components after the index
        newList = _.slice(data, 0, index + 1).concat(newComponents).concat(_.slice(data, index + 1));
      }

      return store.dispatch('saveComponent', { uri: parentURI, data: { [path]: newList }}).then(() => {
        if (replace) {
          store.commit(REMOVE_COMPONENT, currentURI);
        }
        // return the LAST element added
        return find(`[${refAttr}="${_.last(newComponents)[refProp]}"]`);
      });
    });
}

/**
 * replace a single component in another component's property
 * @param {object} store
 * @param {object} data
 * @param {string} parentURI
 * @param {string} path
 * @param {array} components note: it'll only replace using the first thing in this array
 * @returns {Promise}
 */
function addComponentsToComponentProp(store, data, {parentURI, path, components}) {
  const oldURI = data[path][refProp];

  if (components.length > 1) {
    console.warn(`Attempting to add multiple components to a component prop: ${getComponentName(parentURI)} » ${path}. Only the first component (${_.head(components).name}) will be added!`);
  }

  // only create the first one
  return create([_.head(components)]).then((newComponents) => {
    return store.dispatch('saveComponent', { uri: parentURI, data: { [path]: _.head(newComponents) } }).then(() => {
      store.commit(REMOVE_COMPONENT, oldURI);
      // return the LAST element added
      return find(`[${refAttr}="${_.head(newComponents)[refProp]}"]`);
    });
  });
}

/**
 * add one or more components to a page area
 * @param {object} store
 * @param {string} currentURI
 * @param {string} path
 * @param {boolean} replace
 * @param {array} components
 * @returns {Promise}
 */
function addComponentsToPageArea(store, {currentURI, path, replace, components}) {
  const data = _.get(store, `state.page.data[${path}]`),
    index = findIndex(data, currentURI); // get the index before we manipulate the list

  return create(components)
    .then((newComponents) => {
      // note: we have to explicitly save these (rather than relying on the cascading PUT of the parent),
      // because they exist in page data
      return Promise.all(_.map(newComponents, (component) => store.dispatch('saveComponent', { uri: component[refProp], data: component })))
        .then(() => {
          const uris = _.map(newComponents, (component) => component[refProp]);

          // todo: add actual element to the dom, so we don't have to do a page reload
          if (replace) {
            // replace current uri when creating new list
            return _.slice(data, 0, index).concat(uris).concat(_.slice(data, index + 1));
          } else {
            // just add new components after the index
            return _.slice(data, 0, index + 1).concat(uris).concat(_.slice(data, index + 1));
          }
        })
        .then((newList) => {
          if (replace) {
            store.commit(REMOVE_COMPONENT, currentURI);
          }
          // save page
          // todo: add actual element to the dom, so we don't have to do a page reload
          return store.dispatch('savePage', { [path]: newList });
        });
    });
}

/**
 * add components to a parent component (or page)
 * note: allows multiple components to be added at once
 * note: always creates new instances of the components you're adding
 * note: allows you to replace a specific uri, or add components after it
 * note: if no currentURI passed in, it will add new components to the end (and won't replace anything)
 * @param  {object} store
 * @param {string} [currentURI] if adding after / replacing a specific component
 * @param {string} parentURI
 * @param {string} path
 * @param {boolean} [replace] to replace the current URI
 * @param {array} components to add (object with name and [data])
 * @return {Promise} with the last added component's el
 */
export function addComponents(store, { currentURI, parentURI, path, replace, components }) {
  const data = getData(parentURI, path);

  if (replace !== true) {
    // only replace if we're explicitly passed true
    replace = false;
  }

  return store.dispatch('unfocus').then(() => {
    if (_.isArray(data)) {
      // list in a component
      return addComponentsToComponentList(store, data, {currentURI, parentURI, path, replace, components});
    } else if (_.isObject(data)) {
      // prop in a component
      return addComponentsToComponentProp(store, data, {parentURI, path, components}); // note: it'll replace whatever's in the prop
    } else if (_.isString(data)) {
      // list in a page (the string is an alias to a page area)
      return addComponentsToPageArea(store, {currentURI, path, replace, components});
    };
  });
}

/**
 * open the add components pane, or add a new components
 * @param  {object} store
 * @param  {string} [currentURI] if we're inserting after a specific component
 * @param  {string} parentURI
 * @param  {string} path
 * @returns {Promise}
 */
export function openAddComponents(store, { currentURI, parentURI, path }) {
  const schema = getSchema(parentURI, path),
    config = schema[componentListProp] || schema[componentProp],
    allComponents = _.get(store, 'state.locals.components'),
    include = config.include,
    exclude = config.exclude,
    isFuzzy = config.fuzzy;

  let available;

  // figure out what components should be available for adding
  if (include && include.length) {
    available = getAvailableComponents(include, exclude);
  } else {
    available = getAvailableComponents(allComponents, exclude);
  }

  if (available.length === 1) {
    // if there's only one available kind of component to add, simply add it
    return store.dispatch('addComponents', {
      currentURI,
      parentURI,
      path: path,
      components: [{ name: _.head(available) }]
    });
  } else {
    // open the add components pane
    return store.dispatch('openPane', {
      title: 'Add Component',
      position: 'right',
      content: {
        component: 'add-component',
        args: {
          currentURI,
          parentURI,
          path,
          available,
          isFuzzy,
          allComponents
        }
      }
    });
  }
}