import 'babel-polyfill';
import './lib/dnt';

import React from 'react';
import Client from '@r/platform/Client';
import * as actions from '@r/platform/actions';
import { models } from '@r/api-client';
import isEmpty from 'lodash/isEmpty';

import { isLocalStorageAvailable } from '@r/redux-state-archiver';

import App from 'app';
import config from 'config';
import errorLog from 'lib/errorLog';
import routes from 'app/router';
import reducers from 'app/reducers';
import reduxMiddleware from 'app/reduxMiddleware';
import { sendTimings } from 'lib/timing';
import Session from 'app/models/Session';

// register window.onError asap so we can catch errors in the client's init
window.onerror = (message, url, line, column) => {
  errorLog({
    message,
    url,
    line,
    column,
    userAgent: window.navigator.userAgent,
    requestUrl: window.navigator.userAgent,
  }, {
    hivemind: config.statsURL,
  });
};

// This isn't supported in mobile browsers right now but it is in chrome.
// Having it will give us better logging in debug (for promises that don't have
// a .catch handler). Maybe mobile browsers will support it soon as well.
window.onunhandledrejection = rejection => {
  errorLog({
    rejection,
    userAgent: window.navigator.userAgent,
    requestUrl: window.navigator.userAgent,
  }, {
    hivemind: config.statsURL,
  });
};

// start the app now
const beginRender = Date.now();
const client = Client({
  routes,
  reducers,
  reduxMiddleware,
  modifyData: data => {
    // TODO if we start not using shell rendering in a serious way,
    // we'll need to unserialize all of the api models. This should
    // be considered when we debate using JSON output from the models
    // instead of the api model instances.

    if (!isEmpty(data.session)) {
      data.session = new Session(data.session);
      window.session = data.session;
    }

    data.preferences = models.Preferences.fromJSON(data.preferences);

    data.meta.env = 'CLIENT';

    // Pull some defaults from localStorage (if available)
    if (isLocalStorageAvailable()) {
      try {
        const collapsedComments = window.localStorage.collapsedComments;
        if (collapsedComments !== undefined) {
          data.collapsedComments = JSON.parse(collapsedComments);
        }
      } catch (e) { console.warn(e); }

      try {
        const expandedPosts = window.localStorage.expandedPosts;
        if (expandedPosts !== undefined) {
          data.expandedPosts = JSON.parse(expandedPosts);
        }
      } catch (e) { console.warn(e); }

      try {
        const visitedPosts = window.localStorage.visitedPosts;
        if (visitedPosts !== undefined) {
          if (!visitedPosts.startsWith('[')) {
            // Old format -- comma separated string
            data.visitedPosts = visitedPosts.split(',');
          } else {
            data.visitedPosts = JSON.parse(visitedPosts);
          }
        }
      } catch (e) { console.warn(e); }
    }

    return data;
  },
  appComponent: <App/>,
  debug: (process.env.NODE_ENV || 'production') !== 'production',
})();

client.dispatch(actions.activateClient());
sendTimings(beginRender);