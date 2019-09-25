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
            bboxByPage: {},
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
            let bboxByPage = { ...this.state.bboxByPage };
            bboxByPage[page.pageIndex] = positionData;
            //console.log('Data:', positionData);

            let canvas = document.getElementsByTagName('canvas')[page.pageIndex];
            let rect = canvas.getBoundingClientRect();

            let bboxCanvas = document.createElement('canvas');
            bboxCanvas.style.top = rect.y + 'px';
            bboxCanvas.style.left = rect.x + 'px';
            bboxCanvas.style.height = rect.height + 'px';
            bboxCanvas.style.width = rect.width + 'px';
            bboxCanvas.height = rect.height;
            bboxCanvas.width = rect.width;
            bboxCanvas.style.position = 'absolute';
            bboxCanvas.id = 'bboxCanvas' + page.pageIndex;
            bboxCanvas.setAttribute('data-page', page.pageIndex);
            refs.containerRef.appendChild(bboxCanvas);
            let ctx = bboxCanvas.getContext('2d');
            ctx.translate(0, rect.height);   // reset where 0,0 is located
            ctx.scale(1,-1);

            bboxCanvas.onmousemove = this.onBboxMove;

            loadedPages++;
            if (loadedPages === this.state.numPages) {
                this.setState({
                    loading: false,
                    bboxByPage,
                });
            } else {
                this.state.bboxByPage = bboxByPage;
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

    isInBbox({x, y, bboxList}) {
        let bbox = false;
        Object.keys(bboxList).forEach((key) => {
            let isX = x >= bboxList[key].x && x <= (bboxList[key].x + bboxList[key].width);
            let isY = y >= bboxList[key].y && y <= (bboxList[key].y + bboxList[key].height);

            if (isX && isY) {
                bbox = {
                    ...bboxList[key],
                    mcid: key,
                };
            }
        });

        return bbox;
    }

    /*
    *   HANDLERS
     */

    onBboxMove = (e) => {
        let canvas = e.target;
        let rect = canvas.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = canvas.offsetHeight - (e.clientY - rect.top);
        let ctx = canvas.getContext('2d');
        let bboxList = this.state.bboxByPage[canvas.getAttribute('data-page')];

        ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
        ctx.strokeStyle = 'red';
        let bboxCoords = this.isInBbox({ x, y, bboxList});
        if (!bboxCoords) {
            this.fillDocData();
            return;
        }

        let mcid = parseInt(bboxCoords.mcid);
        let { name, relatives, path } = this.getTagName(mcid);
        let tagRoleMapPath = '';
        let minX = 0;
        let maxX = 0;
        let minY = 0;
        let maxY = 0;
        delete relatives[mcid];
        relatives.forEach((elementMcid, index) => {
            let { x, y, width, height } = bboxList[elementMcid];
            if (!index) {
                minX = x;
                maxX = x + width;
                minY = y;
                maxY = y + height;
            }

            minX = minX < x ? minX : x;
            maxX = maxX > (x + width) ? maxX : (x + width);
            minY = minY < y ? minY : y;
            maxY = maxY > (y + height) ? maxY : (y + height);
        });

        if (relatives.length) {
            ctx.strokeRect(minX, minY, maxX-minX, maxY-minY);
        } else {
            ctx.strokeRect(bboxCoords.x, bboxCoords.y, bboxCoords.width, bboxCoords.height);
        }

        if (this.state.roleMap[name]) {
            tagRoleMapPath = '-> ' + this.state.roleMap[name].name;
        }

        this.fillDocData(`${name} ${tagRoleMapPath}`, path.join(' -> '));
    }

    fillDocData(tagName = null, tagPath = null) {
        const EMPTY = 'None';

        if (tagName) {
            refs.activeTagName.textContent = tagName;
            refs.tagPath.classList.remove('_empty');
        } else {
            refs.activeTagName.textContent = EMPTY;
            refs.tagPath.classList.add('_empty');
        }

        if (tagPath) {
            refs.tagPath.textContent = tagPath;
            refs.activeTagName.classList.remove('_empty');
        } else {
            refs.tagPath.textContent = EMPTY;
            refs.activeTagName.classList.add('_empty');
        }
    }

    onUploadFile = (e) => {
        loadedPages = 0;
        this.setState({
            loading: true,
            bboxByPage: {},
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
            bboxByPage: {},
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
