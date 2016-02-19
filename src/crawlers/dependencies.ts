/// <reference path="../../typings/main.d.ts" />

import * as path from 'path';
import * as fs from 'fs';
import * as ts from 'typescript';
import {logger} from '../logger';

let q = require('q');


export namespace Crawler {

    interface NodeObject {
        pos: Number;
        end: Number;
        text: string;
        initializer: {
          text: string;
          elements: NodeObject[]
        };
        name?: {text: string};
        expression?: NodeObject;
        arguments?: NodeObject[];
        properties?: any[];
        parserContextFlags?: Number;
        Component?: String;
    }

    interface Deps {
        name: string;
        file: string;
        directives: string[];
        providers: string[];
        templateUrl: string[];
    }

    export class Dependencies {

        private files: string[];
        private program: ts.Program;
        private engine: any;

        constructor(file: string[]) {
            this.files = file;
            this.program = ts.createProgram(this.files, {
                target: ts.ScriptTarget.ES5,
                module: ts.ModuleKind.CommonJS
            });
        }

        getDependencies() {
            let deps: Deps[] = [];
            this.program.getSourceFiles().map((file) => {

                let filePath = file.fileName;

                if(filePath.lastIndexOf('.d.ts') === -1) {
                    logger.info('parsing', filePath);
                    this.getSourceFileDecorators(file, deps);
                }
                else {
                    logger.warn('ignoring tsd', filePath);
                }

                return deps;

            });

            return deps;
        }


        private getSourceFileDecorators(srcFile: ts.SourceFile, rawDecorators: Deps[]): void {
            ts.forEachChild(srcFile, (node: ts.Node) => {

                if(node.decorators) {
                    let filterByComponent = (node) => /(Component|View)/.test(node.expression.expression.text);
                    let getComponents = (node) => node.expression.arguments.pop();
                    let getProps = (nodes) => nodes.properties;
                    let visitNode = (props, index) => {

                        let componentName = this.getComponentName(node);
                        let component: Deps = {
                            name: componentName,
                            file: srcFile.fileName,
                            directives: this.getComponentDirectives(props),
                            providers: this.getComponentProviders(props),
                            templateUrl: this.getComponentTemplateUrl(props)
                        };

                        rawDecorators.push(component);
                    }

                    node.decorators
                        .filter(filterByComponent)
                        .map(getComponents)
                        .map(getProps)
                        .forEach(visitNode);
                }
                else {
                    //process.stdout.write('.');
                }

            });

        }

        private getComponentName(node): string {
            return node.name.text;
        }

        private getComponentProviders(props: NodeObject[]): string[] {
            return this.getComponentDeps(props, 'providers');
        }

        private getComponentDirectives(props: NodeObject[]): string[] {
            return this.getComponentDeps(props, 'directives');
        }

        private getComponentTemplateUrl(props: NodeObject[]): string[] {
          return this.getComponentDeps(props, 'templateUrl');
        }

        private getComponentDeps(props: NodeObject[], type: string): string[] {
          return props.filter( (node: NodeObject) => {
            return node.name.text === type;
          }).map( (node: NodeObject) => {

            let text = node.initializer.text;
            if(text) {

              if(text.indexOf('/') !== -1){
                text = text.split('/').pop();
              }

              return [text];
            }

            return node.initializer.elements.map((o: NodeObject) => {
              if(o.arguments) {
                return o.arguments.shift().text+'*';
              }
              return o.text;
            });
          }).pop();
        }

  }

}
