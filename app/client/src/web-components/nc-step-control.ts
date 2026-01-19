/*
 * This file is part of mfsender.
 *
 * mfsender is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * mfsender is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with mfsender. If not, see <https://www.gnu.org/licenses/>.
 */

import { defineCustomElement } from 'vue';
import SmartStepControlVue from './SmartStepControl.vue';

const StepControlElement = defineCustomElement(SmartStepControlVue, {
  shadowRoot: false
});

export function registerStepControl() {
  if (!customElements.get('nc-step-control')) {
    customElements.define('nc-step-control', StepControlElement);
  }
}
