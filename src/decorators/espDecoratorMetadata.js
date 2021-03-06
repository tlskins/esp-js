// notice_start
/*
 * Copyright 2015 Dev Shop Limited
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// notice_end

import {ObservationStage} from '../router';

let EspDecoratorMetadata = {
    /**
     * Gets all events for an object instance
     */
    getAllEvents(objectInstance) {
        if (!objectInstance) {
            return [];
        }
        let prototype = Object.getPrototypeOf(objectInstance);
        return prototype._espDecoratorMetadata
            ? prototype._espDecoratorMetadata._events
            : [];
    },
    /**
     * Checks if an object instance has esp related metdata on it's prototype
     * @param objectInstance
     * @returns {boolean}
     */
    hasMetadata(objectInstance) {
        if (!objectInstance) {
            return false;
        }
        let prototype = Object.getPrototypeOf(objectInstance);
        return !!prototype._espDecoratorMetadata;
    },
    /**
     * Gets or creates esp related metadata which is stores as an own prop on the given constructor-function's .prototype property
     */
    getOrCreateMetaData(ctorFunction) {
        if (ctorFunction.prototype.hasOwnProperty('_espDecoratorMetadata')) {
            return ctorFunction.prototype._espDecoratorMetadata;
        } else {
            return _createMetadata(ctorFunction.prototype);
        }
    }
};

let Metadata = {
    init() {
        this._events = [];
        return this;
    },
    addEvent(functionName, eventName, decoratorType, observationStage, predicate, modelId) {
        this._events.push({
            functionName,
            eventName,
            decoratorType,
            observationStage: observationStage || ObservationStage.normal,
            predicate,
            modelId
        });
    }
};

/**
 * _createMetadata(): Create and stores an instance of EspDecoratorMetadata on the given prototype as an own property.
 *
 * Notes:
 * With both Babel and Typescript the object passed to a decorator declared on a class is something that prototypical derives from the base (if any) and has it's constructor property set to the ctor-function/class where the decorator is declared upon.
 * The initial intention with this code was to store the metadata on the constructor, and inspect the constructors prototype to see if it has any metadata of it's own, then our metadata could prototypically derive from that (i.e with Object.create()).
 * This would allow for derived objects to override base and a full lists of events for an object graph to be obtained.
 * Unfortunately Babel and TypeScript have different implementation of the constructor property and make this somewhat problematic.
 *
 * In Babel the `CtorFunctions.prototype` prop is created using prototypical inheritance which one would expect.
 *
 * In Typescript it manually copies properties from the base class to the child class.
 * Typescripts approach made it somewhat problematic to derive a full object graph of events as the metadata on the base class gets copied to all children.
 * If `ChildA` and `ChildB` both derive from `Parent` and both declare event 'foo', this event gets recorded in the Parents metadata twice as it's actually copied to the children upon `_extends`.
 * Storing the metadata as a non enumerable property solved this however if a derived child had no own events the code that retrieved the full list of events had to get the constructor.prototype.prototype which was confusing.
 * It was all a mess just because prototypical inheritance wasn't respected.
 * This only affected TS when it's target was ES5, when targeting ES6 it uses the runtimes own `extends` functionality which work as expected.
 *
 * To get away from the indifference between typescript and Babel I've decided to store the esp metadata on `CtorFunction.prototype`.
 * This isn't affected by the 'own prop' copy issues mentioned above and the code to retrieve the full event graph is consistent regardless of inheritance chain.
 *
 * Issue #136 has more notes on this.
 */
function _createMetadata(prototype) {
    let basePrototype = Object.getPrototypeOf(prototype);

    let metadata = Object.create(Metadata).init();
    // manually copy properties from the prototypes metadata
    if (basePrototype._espDecoratorMetadata) {
        for (let e of basePrototype._espDecoratorMetadata._events) {
            metadata._events.push(e);
        }
    }
    // define an enumerable property on the constructors to hold the metadata.
    // It needs to be enumerable so TS extends can copy it accross.
    Object.defineProperty(prototype, '_espDecoratorMetadata', {
        value: metadata,
        // by default enumerable is false, I'm just being explicit here.
        // When Typescript derives from a base class it copies all own property to the new instance we don't want the metadata copied.
        // To stop it we set enumerable to false. You'd expect this to work using prototypical inheritance so you can override via the prototype chain.
        // Last I looked that's how babel worked.
        enumerable: false
    });
    return metadata;
}

export default EspDecoratorMetadata;