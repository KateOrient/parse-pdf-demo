import React from 'react';
import { Document, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import testPdf from './files/demo_tags.pdf';
import _ from 'lodash';

import PdfPage from './components/PdfPage';
import Header from './components/Header';
import './scss/main.scss';

//  Set pdf.js build
pdfjs.GlobalWorkerOptions.workerSrc = `pdf.worker.js`;
//pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.js`;

let refs = {
    containerRef: null,
    activeTagName: null,
    tagPath: null,
};

let loadedPages = 0;

class App extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            numPages: null,
            pageNumber: 1,
            pdf: testPdf,
            title: testPdf.name,
            boundingBoxes: null,
            renderedPages: 0,
            error: null,
            structureTree: {},
            roleMap: {},
            classMap: {},
            loading: true,
        };
    }

    componentDidUpdate() {
        if (this.state.renderedPages === this.state.numPages) {
            console.log('BBoxes', this.state.boundingBoxes);
            this.setState({renderedPages: 0});
        }
    }

    //  Init data of uploaded PDF
    onDocumentLoadSuccess = (document) => {
        console.log(document);
        let structureTree = document._pdfInfo.structureTree || {};
        document.getMetadata().then(({ info, metadata, contentDispositionFilename, }) => {
            let { RoleMap, ClassMap, Title } = info;
            let title = Title || this.state.pdf.name;
            this.setState({
                title,
                structureTree,
                roleMap: RoleMap || {},
                classMap: ClassMap || {},
            })
        });
        let {numPages} = document;
        this.setState({ numPages });
    };

    //  Create page overlay for BBOXes
    onPageRenderSuccess = (page) => {
        page.getOperatorList().then((data) => {
            let positionData = data.argsArray[data.argsArray.length - 1];
            console.log('Data:', positionData);

            let canvas = document.getElementsByTagName('canvas')[page.pageIndex];
            let rect = canvas.getBoundingClientRect();

            let div = document.createElement('div');
            div.innerHTML = "";
            div.style.top = rect.y + 'px';
            div.style.left = rect.x + 'px';
            div.style.height = rect.height + 'px';
            div.style.width = rect.width + 'px';
            div.style.position = 'absolute';
            div.id = 'div' + page.pageIndex;
            refs.containerRef.appendChild(div);

            div = document.getElementById('div' + page.pageIndex);
            _.map(positionData, (position, mcid) => {
                let child = document.createElement('div');
                child.style.top = parseInt(canvas.style.height, 10) - position.y - position.height  + 'px';
                child.style.left = position.x + 'px';
                child.style.height = position.height + 'px';
                child.style.width = position.width + 'px';
                child.className = 'bbox';
                child.setAttribute('data-mcid', mcid);
            	child.title = mcid;
                //child.onmouseover = this.onBboxOver;
                //child.onmouseout  = this.onBboxOut;
                div.appendChild(child);
            });
            loadedPages++;
            if (loadedPages === this.state.numPages) {
                this.setState({
                    loading: false,
                });
            }
        });
    }

    //  Build pages
    getPages() {
        let pagesArray = [];
        let { numPages } = this.state;

        for (let pageIndex = 1; pageIndex <= numPages; pageIndex++) {
            pagesArray.push(
                <PdfPage pageIndex={pageIndex}
                         onPageRenderSuccess={this.onPageRenderSuccess}
                         key={`page-${pageIndex}`}
                />
            );
        }

        return pagesArray;
    }

    /*
     * Get tag name of hovered bbox
     * @param mcid {integer} id of bbox
     * @param tagNode {object} structure for searching
     *
     * @return {
     *      name {string} tag name
     *      relatives {array} tags from the same level
     *      path {string} path to component through structure tree
     * }
     */
    getTagName(mcid, tagNode = this.state.structureTree) {
        let node = '';
        let relatives = [];
        let path = [];
        Object.keys(tagNode).forEach((nodeName) => {
            path = [nodeName];
            if (tagNode[nodeName] === mcid) {
                node = nodeName;
            } else if (tagNode[nodeName] instanceof Array) {
                if (tagNode[nodeName].includes(mcid)) {
                    node = nodeName;
                    relatives = this.getRelatives(tagNode[nodeName]);
                } else {
                    node = tagNode[nodeName].filter((nodeFromArray) => {
                        if (!nodeFromArray) {
                            return false;
                        }
                        return !!this.getTagName(mcid, nodeFromArray).name;
                    })[0];
                    if (node) {
                        node = this.getTagName(mcid, node);
                        relatives = node.relatives;
                        path = [...path, ...node.path];
                        node = node.name;
                    }
                }
            } else if (tagNode[nodeName] instanceof Object) {
                node = this.getTagName(mcid, tagNode[nodeName]);
                relatives = node.relatives;
                path = [...path, ...node.path];
                node = node.name;
            }
        });

        return {
            name: node,
            relatives,
            path
        };
    }

    //  Get components from on level
    getRelatives(arrayOfRelatives) {
        let relatives = [];
        arrayOfRelatives.forEach((relative) => {
            if (!relative) return;
            if (typeof relative === 'number') {
                relatives.push(relative);
            } else if (relative instanceof Array && relative.length) {
                relatives = [
                    ...relatives,
                    ...this.getRelatives(relative)
                ];
            } else if (relative instanceof Object) {
                relatives = [
                    ...relatives,
                    ...this.getRelatives(Object.entries(relative))
                ];
            }
        });

        return relatives;
    }

    //  Set React ref
    setRef(target) {
        return (node) => {
            refs[target] = node;
        };
    }

    /*
    *   HANDLERS
     */

    //  On bbox mouseover
    onBboxOver = (e) => {
        let mcid = parseInt(e.target.getAttribute('data-mcid'));
        let { name, relatives, path } = this.getTagName(mcid);
        let bboxTagname = e.target.getAttribute('data-tag-name');
        let tagRoleMapPath = '';
        if (!bboxTagname) {
            e.target.setAttribute('data-tag-name', name);
        }

        relatives.forEach((elementMcid) => {
            document.querySelector(`[data-mcid="${elementMcid}"]`).classList.add('_hovered');
        });

        e.target.classList.add('_hovered');

        if (this.state.roleMap[name]) {
            tagRoleMapPath = '-> ' + this.state.roleMap[name].name;
        }

        refs.activeTagName.textContent = `${name} ${tagRoleMapPath}`;
        refs.tagPath.textContent = path.join(' -> ');

        refs.tagPath.classList.remove('_empty');
        refs.activeTagName.classList.remove('_empty');
    }

    //  On bbox mouseout
    onBboxOut = (e) => {
        [...document.querySelectorAll('._hovered')].forEach((el) => {
            el.classList.remove('_hovered');
        });

        refs.activeTagName.textContent = 'None';
        refs.tagPath.textContent = 'None';
        refs.tagPath.classList.add('_empty');
        refs.activeTagName.classList.add('_empty');
    }

    onUploadFile = (e) => {
        loadedPages = 0;
        this.setState({
            loading: true,
        });
        let file = e.target.files[0];
        let reader = new FileReader();

        reader.onload = this.onUploadEnd(file);

        if (!file) {
            this.setState({
                pdf: null,
                loading: false,
            });
            return;
        }
        reader.readAsArrayBuffer(file);
    }

    onUploadSctrictFile = (pdf) => {
        loadedPages = 0;
        this.setState({
            loading: true,
        });
        this.onUploadEnd(pdf);
    }

    onUploadEnd = (pdf) => {
        document.getElementById('container').innerHTML = "";

        this.setState({
            numPages: null,
            pageNumber: 1,
            pdf,
        })
    }

    onError = (e) => {
        this.setState({
            error: e.message,
            loading: false,
        });
    }

    render() {
        const { numPages, title, loading } = this.state;
        return (
            <div className={`App ${loading ? '_loading' : ''}`}>
                <Header onUploadFile={this.onUploadFile} onUploadSctrictFile={this.onUploadSctrictFile} loading={loading}/>
                <main className="app-main-body">
                    <div className="pdf-wrapper">
                        <Document file={this.state.pdf}
                                  onLoadSuccess={this.onDocumentLoadSuccess}
                                  options={{
                                      cMapUrl: `//cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/cmaps/`,
                                      cMapPacked: true,
                                  }}
                                  onLoadError={this.onError}
                                  error={<div className="error-msg">{this.state.error}</div> }
                        >
                            {this.getPages()}
                        </Document>
                    </div>
                </main>
                <div id="container" ref={this.setRef('containerRef')}/>
                <div id="tagInfo">
                    <div className="tag-prop">
                        <div className="tag-info-title">Document title</div>
                        <div ref={this.setRef('activeTagName')} className={title ? '' : '_empty'}>{title || 'None'}</div>
                    </div>
                    <div className="tag-prop">
                        <div className="tag-info-title">Number of pages</div>
                        <div ref={this.setRef('activeTagName')}>{numPages}</div>
                    </div>
                    <div className="tag-prop">
                        <div className="tag-info-title">Tag name</div>
                        <div ref={this.setRef('activeTagName')} className="_empty">None</div>
                    </div>
                    <div className="tag-prop">
                        <div className="tag-info-title">Tree path</div>
                        <div ref={this.setRef('tagPath')} className="_empty">None</div>
                    </div>
                </div>
            </div>
        );
    }
}

export default App;
