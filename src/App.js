import React from 'react';
import {Document, pdfjs} from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import defaultSample from './files/Default_sample.pdf';
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
            pdf: defaultSample,
            title: defaultSample.name,
            boundingBoxes: null,
            renderedPages: 0,
            error: null,
            structureTree: {},
            roleMap: {},
            classMap: {},
            loading: true,
            bboxByPage: {},
            tagsData: null
        };
    }

    componentDidUpdate() {
        if (this.state.renderedPages === this.state.numPages) {
            console.log('BBoxes', this.state.boundingBoxes);
            this.setState({renderedPages: 0});
        }
    }

    /*
     * Calculate bounding boxes by pages
     * @param tagData {array} array of bounding boxes for pages in which all data is stored
     * @param node {object} current structure element
     * @param parent {object} parent object for current node
     * @param path {array} tree path for current node
     */
    getBoundingBoxesFromTree = (tagsData, node = _.cloneDeep(this.state.structureTree), parent = null, path = []) => {
        if (node instanceof Array) {
            node.forEach(child => {
                if (child) {
                    this.getBoundingBoxesFromTree(tagsData, child, node, path);
                }
            });
        } else if (node instanceof Object) {
            if (node.hasOwnProperty('mcid') && node.hasOwnProperty('pageIndex')) { //leaf that has corresponding MCS at the stream
                let bbox = null;
                bbox = this.getBoundingBoxForChildren(parent, node.pageIndex);
                if (!tagsData.hasOwnProperty(node.pageIndex)) {
                    tagsData[node.pageIndex] = [];
                }
                tagsData[node.pageIndex].push({
                    mcid: node.mcid,
                    el_bbox: this.state.bboxByPage[node.pageIndex][node.mcid],
                    bbox: bbox,
                    path: path
                });
            } else if (node.hasOwnProperty('rect') && node.hasOwnProperty('pageIndex')) { //leaf that is Obj and has no corresponding MCS at the stream
                if (!tagsData.hasOwnProperty(node.pageIndex)) {
                    tagsData[node.pageIndex] = [];
                }
                let bbox = {
                    x: Math.min(node.rect[0], node.rect[2]),
                    y: Math.min(node.rect[1], node.rect[3]),
                    width: Math.abs(node.rect[0] - node.rect[2]),
                    height: Math.abs(node.rect[1] - node.rect[3])
                };
                tagsData[node.pageIndex].push({
                    pageIndex: node.pageIndex,
                    el_bbox: bbox,
                    bbox: bbox,
                    path: path
                });
            } else if (node.hasOwnProperty('name') && node.hasOwnProperty('children')) {
                this.getBoundingBoxesFromTree(tagsData, node.children, node, [...path, node.name]);
            }
        }
    };

    uniteBoundingBoxes = (newBoundingBox, oldBoundingBox) => {
        if (_.isNil(newBoundingBox)) {
            return oldBoundingBox;
        } else if (_.isNil(oldBoundingBox)) {
            return _.cloneDeep(newBoundingBox);
        } else {
            return {
                x: Math.min(newBoundingBox.x, oldBoundingBox.x),
                y: Math.min(newBoundingBox.y, oldBoundingBox.y),
                width: Math.max(newBoundingBox.x + newBoundingBox.width, oldBoundingBox.x + oldBoundingBox.width) - Math.min(newBoundingBox.x, oldBoundingBox.x),
                height: Math.max(newBoundingBox.y + newBoundingBox.height, oldBoundingBox.y + oldBoundingBox.height) - Math.min(newBoundingBox.y, oldBoundingBox.y)
            };
        }
    };

    //Get bounding boxes for elements at the same level
    getBoundingBoxForChildren = (node, pageIndex) => {
        if (node instanceof Array) {
            let bbox = null;
            node.map(child => bbox = this.uniteBoundingBoxes(this.getBoundingBoxForChildren(child, pageIndex), bbox));
            return bbox;
        } else if (node instanceof Object) {
            if (node.hasOwnProperty('mcid') && node.hasOwnProperty('pageIndex')) {
                let currentBbox = this.state.bboxByPage[node.pageIndex][node.mcid];
                if (!_.isNil(currentBbox) && !_.isNaN(currentBbox.x) && !_.isNaN(currentBbox.y)
                    && !_.isNaN(currentBbox.width) && !_.isNaN(currentBbox.height) && node.pageIndex === pageIndex) {
                    return currentBbox;
                }
                return null;
            } else {
                let bbox = null;
                Object.keys(node).map(childKey => {
                    bbox = this.uniteBoundingBoxes(this.getBoundingBoxForChildren(node[childKey], pageIndex), bbox);
                });
                return bbox;
            }
        }
    };

    //  Init data of uploaded PDF
    onDocumentLoadSuccess = (document) => {
        console.log(document);
        let structureTree = document._pdfInfo.structureTree || {};
        document.getMetadata().then(({info, metadata, contentDispositionFilename,}) => {
            let {RoleMap, ClassMap, Title} = info;
            let title = Title || this.state.pdf.name;
            this.setState({
                title,
                structureTree,
                roleMap: RoleMap || {},
                classMap: ClassMap || {},
            })
        });
        let {numPages} = document;
        this.setState({numPages});
    };

    //  Create page overlay for BBOXes
    onPageRenderSuccess = (page) => {
        page.getOperatorList().then((data) => {
            let positionData = data.argsArray[data.argsArray.length - 1];
            let bboxByPage = {...this.state.bboxByPage};
            bboxByPage[page.pageIndex] = positionData || {};
            console.log('Data:', page.pageIndex, positionData);

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
            ctx.scale(1, -1);

            bboxCanvas.onmousemove = this.onBboxMove;

            loadedPages++;
            if (loadedPages === this.state.numPages) {
                this.setState({
                    loading: false,
                    bboxByPage,
                }, () => {
                    let tagsData = {};
                    this.getBoundingBoxesFromTree(tagsData);
                    console.log(tagsData);
                    this.setState({tagsData});
                });
            } else {
                this.state.bboxByPage = bboxByPage;
            }
        });
    }

    //  Build pages
    getPages() {
        let pagesArray = [];
        let {numPages} = this.state;

        for (let pageIndex = 1; pageIndex <= numPages; pageIndex++) {
            pagesArray.push(
                <PdfPage pageIndex={pageIndex}
                         onPageRenderSuccess={this.onPageRenderSuccess}
                         key={"page-" + pageIndex}
                />
            );
        }

        return pagesArray;
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

    onBboxMove = (e) => {
        let canvas = e.target;
        let rect = canvas.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = canvas.offsetHeight - (e.clientY - rect.top);
        let ctx = canvas.getContext('2d');
        let pageIndex = canvas.getAttribute('data-page');
        let tagsDataByPage = this.state.tagsData[pageIndex];

        ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
        ctx.strokeStyle = 'red';

        let tagData = _.find(tagsDataByPage, data => x >= data.el_bbox.x && x <= data.el_bbox.x + data.el_bbox.width &&
            y >= data.el_bbox.y && y <= data.el_bbox.y + data.el_bbox.height);

        if (!tagData) {
            this.fillDocData();
        } else {
            ctx.strokeRect(tagData.bbox.x, tagData.bbox.y, tagData.bbox.width, tagData.bbox.height);
            this.fillDocData(tagData.path[tagData.path.length - 1], tagData.path.join(' -> '), tagData.mcid);
        }
    };

    fillDocData = (tagName = null, tagPath = null, mcid = null) => {
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

        if (Number.isInteger(mcid)) {
            refs.mcid.textContent = mcid;
            refs.mcid.classList.remove('_empty');
        } else {
            refs.mcid.textContent = EMPTY;
            refs.mcid.classList.add('_empty');
        }
    };

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
    };

    onUploadSctrictFile = (pdf) => {
        loadedPages = 0;
        this.setState({
            loading: true,
            bboxByPage: {},
        });
        this.onUploadEnd(pdf);
    };

    onUploadEnd = (pdf) => {
        document.getElementById('container').innerHTML = "";

        this.setState({
            numPages: null,
            pageNumber: 1,
            pdf,
        })
    };

    onError = (e) => {
        this.setState({
            error: e.message,
            loading: false,
        });
    };

    render() {
        const {numPages, title, loading} = this.state;
        return (
            <div className={`App ${loading ? '_loading' : ''}`}>
                <Header onUploadFile={this.onUploadFile} onUploadSctrictFile={this.onUploadSctrictFile}
                        loading={loading}/>
                <main className="app-main-body">
                    <div className="pdf-wrapper">
                        <Document file={this.state.pdf}
                                  onLoadSuccess={this.onDocumentLoadSuccess}
                                  options={{
                                      cMapUrl: `//cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/cmaps/`,
                                      cMapPacked: true,
                                  }}
                                  onLoadError={this.onError}
                                  error={<div className="error-msg">{this.state.error}</div>}
                        >
                            {this.getPages()}
                        </Document>
                    </div>
                </main>
                <div id="container" ref={this.setRef('containerRef')}/>
                <div id="tagInfo">
                    <div className="tag-prop">
                        <div className="tag-info-title">Document title</div>
                        <div ref={this.setRef('activeTagName')}
                             className={title ? '' : '_empty'}>{title || 'None'}</div>
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
                    <div className="tag-prop">
                        <div className="tag-info-title">MCID</div>
                        <div ref={this.setRef('mcid')} className="_empty">None</div>
                    </div>
                </div>
            </div>
        );
    }
}

export default App;
