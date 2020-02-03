import * as fs from 'fs';
import {
    read as readLastLines
} from 'read-last-lines';

import {
    getNextStateSet,
    binaryToDecimal
} from './binary-state';
import {
    StateSet,
    ActionName,
    StateSetToActionMap
} from '../types';
import { calculateActionForState } from './calculate-action-for-state';
import { getReuseableChangeEvents } from './data-generator';

export const KEY_VALUE_DELIMITER = ':';

export async function generateLogicMap(
    logicMapFilePath: string,
    startStateSet: StateSet,
    endStateSet: StateSet,
    amountOfTestEvents: number,
    showState: boolean = true
) {
    // run this here to not influence time measurement
    await getReuseableChangeEvents(amountOfTestEvents);

    const startTime = new Date().getTime();
    let stateSet: StateSet = startStateSet;
    const totalAmount = binaryToDecimal(endStateSet) - binaryToDecimal(startStateSet);

    if (fs.existsSync(logicMapFilePath)) {
        // file exists continue from there
        const lastLine = await readLastLines(logicMapFilePath, 1);
        if (showState) {
            console.log('last line of previous calculation: ' + lastLine);
        }
        const split = lastLine.split(':');
        stateSet = split[0];
    }

    const writeStream = fs.createWriteStream(
        logicMapFilePath, {
        flags: 'a' // append to existing file
    });

    let doneAmount = binaryToDecimal(stateSet) - binaryToDecimal(startStateSet);
    let logState = 0;

    const stateSetToActionMap: StateSetToActionMap = new Map();

    let done = false;
    while (!done) {
        logState++;
        const action: ActionName = await calculateActionForState(
            stateSet,
            stateSetToActionMap
        );

        const keyValue = stateSet + KEY_VALUE_DELIMITER + action;
        writeStream.write(keyValue + '\n');

        // add to map so later runs go faster
        stateSetToActionMap.set(stateSet, action);

        doneAmount++;

        // do not log each time because that would kill the performance
        if (logState >= 50) {
            logState = 0;
            if (showState) {
                const now = new Date().getTime();
                const diff = (now - startTime) / 1000;
                const statesPerSecond = doneAmount / diff;
                console.log('# processing: ' + doneAmount + '/' + totalAmount);
                console.log('# statesPerSecond: ' + statesPerSecond);
            }
        }

        if (stateSet === endStateSet) {
            done = true;
        } else {
            stateSet = getNextStateSet(stateSet);
        }
    }

}