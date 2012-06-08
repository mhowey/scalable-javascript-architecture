﻿/*globals Core, $*/
Core.Ajax = (function (ajaxLibrary) {

   var dateFactory = {
      getNewDate: function () {
         return new Date();
      }
   },

   tryCallFunction = function (callback, context, argument) {
      if (typeof callback === "function") {
         if (context === undefined) {
            callback(argument);
         }
         else {
            callback.call(context, argument);
         }
      }
   },

   callSuccess = function (moduleId, tempRequest, returnValue) {
      if (Core.moduleIsActive(moduleId)) {
         if (returnValue.RequestSucceeded === undefined) {
            tryCallFunction(tempRequest.success, tempRequest.context, returnValue);
         }
         else if (returnValue.RequestSucceeded === true) {
            tryCallFunction(tempRequest.success, tempRequest.context, returnValue.Value);
         }
         else if (returnValue.RequestSucceeded === false) {
            tryCallFunction(tempRequest.failure, tempRequest.context, returnValue.ErrorMessages);
         }
         else {
            tryCallFunction(tempRequest.success, tempRequest.context, returnValue);
         }
      }
   },

   callFailure = function (moduleId, tempRequest, returnValue) {
      if (Core.moduleIsActive(moduleId)) {
         tryCallFunction(tempRequest.failure, tempRequest.context, returnValue);
      }
   },

   compareRequestData = function (cachedData, data) {
      var property,
              returnValue = true;

      if (cachedData === data) {
         returnValue = true;
      }
      else if (cachedData === undefined) {
         returnValue = true;
      }
      else if (data === undefined) {
         returnValue = true;
      }
      else if (cachedData === null) {
         returnValue = true;
      }
      else if (data === null) {
         returnValue = true;
      }
      //compare the properties
      else {
         for (property in cachedData) {
            if (cachedData.hasOwnProperty(property) && data[property] !== cachedData[property]) {
               returnValue = false;
               break;
            }
         }
      }
      return returnValue;
   },

   cache = (function () {
      var cachedRequests = {},
      cacheItemExistsAndIsNotExpired = function (cachedRequest, requestData, urlMapping) {
         var returnValue;

         if (cachedRequest === undefined || cachedRequest === null) {
            returnValue = false;
         }
         else if (compareRequestData(cachedRequest.requestData, requestData.data) === false) {
            returnValue = false;
         }
         //no cache expiry
         else if (urlMapping.cacheDuration === undefined) {
            returnValue = true;
         }
         //0 or negative value = no cache expiry
         else if (urlMapping.cacheDuration <= 0) {
            returnValue = true;
         }
         else if (urlMapping.cacheDuration > dateFactory.getNewDate().getTime() - cachedRequest.cachedTime.getTime()) {
            returnValue = true;
         }
         else {
            returnValue = false;
         }

         return returnValue;
      };

      return {
         clearCache: function () {
            cachedRequests = {};
         },
         removeCache: function (urlMapping, requestData) {
            var i,
              arrayLength,
              found = false,
              cachedRequestArray = cachedRequests[urlMapping.name];

            if (cachedRequestArray !== undefined) {
               for (i = 0, arrayLength = cachedRequestArray.length; i < arrayLength && found === false; i++) {
                  found = compareRequestData(cachedRequestArray[i], requestData);
               }
               if (found) {
                  cachedRequestArray.slice(i - 1);
               }
            }
         },

         cacheExistsAndIsNotExpired: function (urlMapping, requestData) {
            var i,
              arrayLength,
              returnValue,
              cachedRequestArray = cachedRequests[urlMapping.name];

            if (cachedRequestArray === undefined) {
               returnValue = false;
            }
            else {
               returnValue = false;
               for (i = 0, arrayLength = cachedRequestArray.length; i < arrayLength && returnValue === false; i++) {
                  returnValue = cacheItemExistsAndIsNotExpired(cachedRequestArray[i], requestData, urlMapping);
               }
            }
            return returnValue;
         },

         getCachedRequest: function (urlMapping, requestData) {
            var i,
              arrayLength,
              temp,
              returnValue = null,
              cachedRequestArray = cachedRequests[urlMapping.name];

            for (i = 0, arrayLength = cachedRequestArray.length; i < arrayLength && returnValue === null; i++) {
               temp = cachedRequestArray[i];
               if (compareRequestData(temp.requestData, requestData.data)) {
                  returnValue = temp.ajaxReturnValue;
               }
            }

            return returnValue;
         },

         addDataToCache: function (returnValue, urlMapping, requestData) {
            var cachedRequest = {
               requestData: requestData.data,
               ajaxReturnValue: returnValue,
               cachedTime: dateFactory.getNewDate()
            };

            if (!cachedRequests[urlMapping.name]) {
               cachedRequests[urlMapping.name] = [];
            }

            cachedRequests[urlMapping.name].push(cachedRequest);
         }
      };
   })(),

   queue = (function () {

      var requestArray = []; // Object syntax should be the same as incoming request data, except that success and fail are arrays

      return {
         requestIsInQueue: function (requestData) {
            var i,
                 arrayLength,
                 requestExists = false;
            if (requestArray.length > 0) {
               for (i = 0, arrayLength = requestArray.length; i < arrayLength && !requestExists; i++) {
                  if (requestArray[i].name === requestData.name && compareRequestData(requestArray[i].data, requestData.data)) {
                     requestExists = true;
                  }
               }
            }
            return requestExists;
         },

         addRequestToQueue: function (moduleId, requestData) {
            requestData.moduleId = moduleId;
            requestArray.push(requestData);
         },

         getAllRequests: function (requestData) {
            var allRequests = [],
                 request,
                 i,
                 arrayLength;

            if (requestArray.length > 0) {
               for (i = 0, arrayLength = requestArray.length; i < arrayLength; i++) {
                  request = requestArray[i];
                  if (request.name === requestData.name && compareRequestData(request.data, requestData.data)) {
                     allRequests.push(request);
                  }
               }
            }
            return allRequests;
         },

         removeAllMatchingRequests: function (requestData) {
            var request,
                 i;

            if (requestArray.length > 0) {
               //remove all requests in reverse so we dont overflow the array bounds
               for (i = requestArray.length - 1; i >= 0; i--) {
                  request = requestArray[i];
                  if (request.name === requestData.name && compareRequestData(request.data, requestData.data)) {
                     requestArray.splice(i, 1);
                  }
               }
            }
         }
      };
   })(),

   urlMapper = (function () {

      var urlMappings = {};
      var baseUrl = "";

      return {
         setBaseUrl: function (newBaseUrl) {
            baseUrl = newBaseUrl;
         },
         getMapping: function (name) {
            return urlMappings[name];
         },
         removeMapping: function (parameter) {
            delete urlMappings[parameter];
         },
         removeAllMappings: function () {
            urlMappings = {};
         },
         addMapping: function (parameters) {
            var newMapping = {},
              property,
             propertyValue;

            if (parameters.name === undefined || parameters.name === null || parameters.name === "") {
               throw new Error("URL mapping cannot be defined without a name");
            }
            else if (urlMappings[parameters.name] !== undefined) {
               throw new Error("Duplicate URL mapping defined for mapping ID: " + parameters.name);
            }
            else {
               for (property in parameters) {
                  if (parameters.hasOwnProperty(property)) {
                     propertyValue = parameters[property];
                     if (property === "url") {
                        propertyValue = baseUrl + propertyValue;
                     }
                     newMapping[property] = propertyValue;
                  }
               }
               if (newMapping.cacheDuration !== undefined && isNaN(newMapping.cacheDuration) === false) {
                  //turn the cache duration into milliseconds (entered in minutes)
                  newMapping.cacheDuration = newMapping.cacheDuration * 1000 * 60;
               }
               urlMappings[parameters.name] = newMapping;
            }
         }
      };
   })();

   return {

      UrlMapper: urlMapper,

      clearCache: function () {
         cache.clearCache();
      },

      //this allows for the injection of a date service
      //so as to easily unit test the timeout
      setDateFactory: function (newDateFactory) {
         dateFactory = newDateFactory;
      },

      //   requestData = {
      //      name: urlMapping
      //      data: data to send to the server - optional
      //      context: callback context - optional
      //      success: callback function (response) - optional
      //      failure: callback function (error message) - optional
      //   }
      request: function (requestData, moduleId) {
         //first look up the URL
         var urlMapping = Core.Ajax.UrlMapper.getMapping(requestData.name);

         var ajaxMessage,
             callFunction = function (responseFunction, returnValue) {
                var i,
                    arrayLength,
                    tempRequest,
                    allMatchingRequests,
                    functionExecuted = false;

                if (urlMapping.queueRequest === true) {
                   allMatchingRequests = queue.getAllRequests(requestData);
                   for (i = 0, arrayLength = allMatchingRequests.length; i < arrayLength; i++) {
                      tempRequest = allMatchingRequests[i];
                      responseFunction(tempRequest.moduleId, tempRequest, returnValue);
                      functionExecuted = true;
                   }
                   queue.removeAllMatchingRequests(requestData);
                }

                //when we get a request that is cached and queued
                //it looks through the queue for the callbacks,
                //however there may be nothing else in the queue and
                //because the request is cached it never gets added to the queue
                if (functionExecuted === false) {
                   responseFunction(moduleId, requestData, returnValue);
                }
             },
             success = function (returnValue) {
                callFunction(callSuccess, returnValue);
             },
             failure = function (returnValue) {
                callFunction(callFailure, returnValue);
             },
             errorFunc = function (jqXhr, textStatus, errorThrown) {
                //when a page navigate occurs ajax requests are cancelled, both status and ready state are 0
                if (jqXhr.status === 0 && jqXhr.readyState === 0) { }
                else {
                   callFunction(callFailure, errorThrown);
                }
             },
             successAndCache = function (ajaxReturnValue) {
                cache.addDataToCache(ajaxReturnValue, urlMapping, requestData);
                success(ajaxReturnValue);
             };

         if (requestData === null || requestData === undefined) {
            throw new Error("Ajax request passed no data");
         }
         else if (requestData.name === undefined || requestData.name === null || requestData.name === "") {
            throw new Error("Ajax request passed empty request name");
         }
         else if (urlMapping === null || urlMapping === undefined) {
            throw new Error("No URL defined for " + requestData.name);
         }
         else if (cache.cacheExistsAndIsNotExpired(urlMapping, requestData)) {
            success(cache.getCachedRequest(urlMapping, requestData));
         }
         else {
            //clean out the cache if it exists
            cache.removeCache(urlMapping, requestData);

            if (urlMapping.queueRequest === true && queue.requestIsInQueue(requestData) === true) {
               //we dont want to do the whole ajax call, just add this to the queue as well
               queue.addRequestToQueue(moduleId, requestData);
            }
            else {
               if (urlMapping.queueRequest === true) {
                  //we still want to add it to the queue however, so other requests 'know' it is there
                  queue.addRequestToQueue(moduleId, requestData);
               }

               ajaxMessage = {
                  url: urlMapping.url,
                  type: urlMapping.ajaxType,
                  traditional: true,
                  failure: failure,
                  error: errorFunc,
                  cache: false
               };

               if (urlMapping.cache === true) {
                  ajaxMessage.success = successAndCache;
               }
               else {
                  ajaxMessage.success = success;
               }

               //add additional data if required
               if (requestData.data !== undefined) {
                  ajaxMessage.data = requestData.data;
               }
               if (requestData.context !== undefined) {
                  ajaxMessage.context = requestData.context;
               }

               ajaxLibrary.ajax(ajaxMessage);
            }
         }
      }
   };
})($);